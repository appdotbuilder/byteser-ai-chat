import { useState, useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MessageSquare, 
  MoreHorizontal, 
  Edit2, 
  Trash2,
  Clock
} from 'lucide-react';
import type { Conversation } from '../../../server/src/schema';

interface SidebarProps {
  userId: number;
}

export function Sidebar({ userId }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true);
        const result = await trpc.getConversations.query({ userId });
        setConversations(result);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [userId]);

  // Search conversations
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // Reload all conversations if search is empty
      const result = await trpc.getConversations.query({ userId });
      setConversations(result);
      return;
    }

    try {
      const result = await trpc.searchConversations.query({ 
        userId, 
        query: searchQuery 
      });
      setConversations(result);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const startEdit = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      await trpc.updateConversation.mutate({
        id: editingId,
        title: editTitle,
        userId
      });
      
      setConversations((prev: Conversation[]) => 
        prev.map((conv: Conversation) => 
          conv.id === editingId ? { ...conv, title: editTitle } : conv
        )
      );
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const deleteConversation = async (conversationId: number) => {
    try {
      await trpc.deleteConversation.mutate({ 
        conversationId, 
        userId 
      });
      setConversations((prev: Conversation[]) => 
        prev.filter((conv: Conversation) => conv.id !== conversationId)
      );
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupConversationsByDate = (conversations: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {};
    
    conversations.forEach((conv: Conversation) => {
      const dateKey = formatDate(conv.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(conv);
    });
    
    return groups;
  };

  const groupedConversations = groupConversationsByDate(conversations);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            className="pl-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
            </div>
          ) : Object.keys(groupedConversations).length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to get started</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedConversations).map(([dateGroup, groupConversations]) => (
                <div key={dateGroup}>
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {dateGroup}
                  </h3>
                  <div className="space-y-1">
                    {groupConversations.map((conversation: Conversation) => (
                      <div key={conversation.id} className="group relative">
                        {editingId === conversation.id ? (
                          <div className="px-3 py-2">
                            <Input
                              value={editTitle}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                              onKeyPress={(e: React.KeyboardEvent) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              onBlur={saveEdit}
                              autoFocus
                              className="text-sm"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {conversation.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {conversation.created_at.toLocaleDateString()}
                              </p>
                            </div>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => startEdit(conversation)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => deleteConversation(conversation.id)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}