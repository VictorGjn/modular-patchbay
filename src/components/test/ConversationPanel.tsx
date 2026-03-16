import { useTheme } from '../../theme';
import { useConversationStore } from '../../store/conversationStore';
import { MessageCircle } from 'lucide-react';

interface ConversationPanelProps {
  conversationId?: string;
}

export function ConversationPanel({ conversationId: _ }: ConversationPanelProps) {
  const t = useTheme();
  const messages = useConversationStore(s => s.messages);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div 
        className="px-3 py-2 border-b flex-shrink-0"
        style={{ 
          borderColor: t.border, 
          background: t.surfaceElevated,
          color: t.textPrimary
        }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={14} style={{ color: '#FE5000' }} />
          <h3 className="text-sm font-medium" style={{ fontFamily: "'Geist Sans', sans-serif" }}>
            Conversation
          </h3>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden p-3" style={{ background: t.surface }}>
        {messages.length > 0 ? (
          <div className="space-y-2">
            {messages.slice(-5).map((message) => (
              <div 
                key={message.id} 
                className="p-2 rounded text-xs"
                style={{ 
                  background: message.role === 'user' ? t.surfaceElevated : t.surface,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary
                }}
              >
                <div className="font-medium text-[10px] mb-1" style={{ color: t.textSecondary }}>
                  {message.role.toUpperCase()}
                </div>
                <div className="line-clamp-3">
                  {message.content.length > 200 
                    ? `${message.content.slice(0, 200)}...` 
                    : message.content
                  }
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div 
            className="text-center text-sm"
            style={{ color: t.textSecondary }}
          >
            No conversation selected
          </div>
        )}
      </div>
    </div>
  );
}