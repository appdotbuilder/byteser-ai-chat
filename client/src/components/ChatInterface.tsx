import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, Sparkles, Globe, Loader2, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Message, Conversation } from '../../../server/src/schema';

interface ChatInterfaceProps {
  userId: number;
}

export function ChatInterface({ userId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enableResearch, setEnableResearch] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const startNewConversation = async () => {
    try {
      const conversation = await trpc.createConversation.mutate({
        user_id: userId,
        title: 'New conversation'
      });
      setCurrentConversation(conversation);
      setMessages([]);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    let conversation = currentConversation;
    
    // Create new conversation if none exists
    if (!conversation) {
      try {
        conversation = await trpc.createConversation.mutate({
          user_id: userId,
          title: inputMessage.slice(0, 50) + (inputMessage.length > 50 ? '...' : '')
        });
        setCurrentConversation(conversation);
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Add user message to UI immediately
      const userMsg: Message = {
        id: Date.now(), // Temporary ID
        conversation_id: conversation.id,
        content: userMessage,
        role: 'user',
        sources: null,
        created_at: new Date()
      };
      setMessages(prev => [...prev, userMsg]);

      // Create user message first
      const createdUserMessage = await trpc.createMessage.mutate({
        conversation_id: conversation.id,
        content: userMessage,
        role: 'user'
      });

      // Send to backend for AI processing
      const aiResponse = await trpc.aiChatResearch.mutate({
        conversation_id: conversation.id,
        message: userMessage,
        enable_research: enableResearch
      });

      // Replace temp message with real messages
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove temp message
        createdUserMessage,
        aiResponse
      ]);

    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the temporary message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatMessage = (content: string) => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>');
  };

  if (!currentConversation && messages.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#0d0d0d]">
        {/* Welcome Screen */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to ByteSer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            Your AI-powered research assistant. Ask me anything and I'll search the web, 
            analyze information, and provide comprehensive answers with cited sources.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-4xl w-full">
            <Card className="p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer">
              <div className="flex items-center mb-3">
                <Globe className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Web Research</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Search and analyze information from across the internet
              </p>
            </Card>
            
            <Card className="p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer">
              <div className="flex items-center mb-3">
                <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Analysis</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Advanced AI processing for comprehensive insights
              </p>
            </Card>
            
            <Card className="p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer">
              <div className="flex items-center mb-3">
                <Copy className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Cited Sources</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All answers include relevant sources and references
              </p>
            </Card>
          </div>

          <Button onClick={startNewConversation} size="lg" className="bg-blue-600 hover:bg-blue-700">
            Start New Conversation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0d0d0d]">
      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div key={message.id} className="space-y-4">
              {message.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div 
                        className="prose dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                      />
                      
                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="space-y-2">
                          <Separator />
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                            <Globe className="w-4 h-4 mr-1" />
                            Sources
                          </h4>
                          <div className="space-y-2">
                            {message.sources.map((source, sourceIndex) => (
                              <Card key={sourceIndex} className="p-3 bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                                      {source.title}
                                    </h5>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                      {source.snippet}
                                    </p>
                                    <a 
                                      href={source.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    >
                                      {source.url}
                                    </a>
                                  </div>
                                  <Badge variant="secondary" className="text-xs ml-2">
                                    {sourceIndex + 1}
                                  </Badge>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Actions */}
                      <div className="flex items-center space-x-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyMessage(message.content)}
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {isLoading && index === messages.length - 1 && message.role === 'user' && (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-md px-4 py-3">
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">
                          {enableResearch ? 'Researching and analyzing...' : 'Thinking...'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-[#0d0d0d]">
        <div className="max-w-4xl mx-auto">
          {/* Research Toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Button
                variant={enableResearch ? "default" : "outline"}
                size="sm"
                onClick={() => setEnableResearch(!enableResearch)}
                className={enableResearch ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                <Globe className="w-4 h-4 mr-1" />
                {enableResearch ? "Research On" : "Research Off"}
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {enableResearch ? "AI will search the web for current information" : "AI will use only its training data"}
              </span>
            </div>
          </div>

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              className="resize-none pr-12 min-h-[50px] max-h-[120px] border-gray-300 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            ByteSer can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}