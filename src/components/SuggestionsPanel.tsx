import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import { Suggestion } from '@/types/call-center';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
}

export const SuggestionsPanel = ({ suggestions }: SuggestionsPanelProps) => {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          AI Suggestions
          <Badge variant="outline">
            {suggestions.length}/3
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>AI suggestions will appear here...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="p-4 bg-accent/50 rounded-lg border border-accent transition-all hover:bg-accent/70"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Suggestion {index + 1}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(suggestion.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-accent-foreground">
                  {suggestion.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};