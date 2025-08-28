import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const KnowledgeBaseAdmin = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const generateEmbeddings = async () => {
    setIsGenerating(true);
    setStatus('idle');
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-embeddings');

      if (error) {
        throw error;
      }

      setResult(data);
      setStatus('success');
      toast({
        title: "Success",
        description: `Generated embeddings for ${data.processed} knowledge base entries`,
      });
    } catch (error) {
      console.error('Error generating embeddings:', error);
      setStatus('error');
      toast({
        title: "Error",
        description: "Failed to generate embeddings",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5" />
          <span>Knowledge Base Admin</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Generate vector embeddings for knowledge base entries to enable semantic search in the chatbot.
        </div>
        
        <Button 
          onClick={generateEmbeddings}
          disabled={isGenerating}
          className="w-full"
        >
          <Zap className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generating...' : 'Generate Embeddings'}
        </Button>

        {status === 'success' && result && (
          <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div className="text-sm">
              <div className="font-medium text-green-800">Success!</div>
              <div className="text-green-600">
                Processed {result.processed} of {result.total} entries
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div className="text-sm text-red-800">
              Failed to generate embeddings
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Features enabled:</div>
            <div className="space-y-1">
              <Badge variant="outline" className="mr-2">Vector Search</Badge>
              <Badge variant="outline" className="mr-2">User Context</Badge>
              <Badge variant="outline" className="mr-2">Order History</Badge>
              <Badge variant="outline">Cart Access</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};