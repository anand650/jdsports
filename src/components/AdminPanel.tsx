import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Database, Plus, Edit, Trash2, Zap, Eye, EyeOff, Upload, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { bulkImportKnowledge, clearKnowledgeBase } from '@/utils/bulkKnowledgeImport';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  embedding: any;
  created_at: string;
}

export const AdminPanel = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    category: 'general'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (showPanel) {
      fetchEntries();
    }
  }, [showPanel]);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast({
        title: "Error",
        description: "Failed to fetch knowledge base entries",
        variant: "destructive",
      });
    }
  };

  const addEntry = async () => {
    if (!newEntry.title || !newEntry.content) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .insert({
          title: newEntry.title,
          content: newEntry.content,
          category: newEntry.category,
          is_active: true
        });

      if (error) throw error;

      setNewEntry({ title: '', content: '', category: 'general' });
      fetchEntries();
      toast({
        title: "Success",
        description: "Knowledge base entry added successfully",
      });
    } catch (error) {
      console.error('Error adding entry:', error);
      toast({
        title: "Error",
        description: "Failed to add entry",
        variant: "destructive",
      });
    }
  };

  const updateEntry = async () => {
    if (!editingEntry) return;

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .update({
          title: editingEntry.title,
          content: editingEntry.content,
          category: editingEntry.category,
          is_active: editingEntry.is_active,
          embedding: null // Reset embedding so it gets regenerated
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      setEditingEntry(null);
      fetchEntries();
      toast({
        title: "Success",
        description: "Entry updated successfully",
      });
    } catch (error) {
      console.error('Error updating entry:', error);
      toast({
        title: "Error",
        description: "Failed to update entry",
        variant: "destructive",
      });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchEntries();
      toast({
        title: "Success",
        description: "Entry deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      });
    }
  };

  const toggleEntryStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      fetchEntries();
      toast({
        title: "Success",
        description: `Entry ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling entry status:', error);
      toast({
        title: "Error",
        description: "Failed to update entry status",
        variant: "destructive",
      });
    }
  };

  const handleBulkImport = async () => {
    const result = await bulkImportKnowledge();
    if (result.success) {
      fetchEntries();
      toast({
        title: "Success",
        description: result.message,
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all knowledge base entries? This cannot be undone.')) {
      return;
    }
    
    const result = await clearKnowledgeBase();
    if (result.success) {
      fetchEntries();
      toast({
        title: "Success",
        description: result.message,
      });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };
  const generateEmbeddings = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-embeddings');

      if (error) throw error;

      fetchEntries(); // Refresh to show updated embeddings
      toast({
        title: "Success",
        description: `Generated embeddings for ${data.processed} entries`,
      });
    } catch (error) {
      console.error('Error generating embeddings:', error);
      toast({
        title: "Error",
        description: "Failed to generate embeddings",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = ['general', 'policy', 'sizing', 'shipping', 'returns', 'loyalty', 'discount', 'technical'];

  if (!showPanel) {
    return (
      <Button
        onClick={() => setShowPanel(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-6 left-6 z-40"
      >
        <Database className="h-4 w-4 mr-2" />
        Admin
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Knowledge Base Admin</span>
          </CardTitle>
          <Button variant="ghost" onClick={() => setShowPanel(false)}>×</Button>
        </CardHeader>
        
        <CardContent className="overflow-y-auto">
          <Tabs defaultValue="entries" className="space-y-4">
            <TabsList>
              <TabsTrigger value="entries">Manage Entries ({entries.length})</TabsTrigger>
              <TabsTrigger value="add">Add New</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
              <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
            </TabsList>

            <TabsContent value="entries" className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {entries.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium">{entry.title}</h3>
                          <Badge variant="outline">{entry.category}</Badge>
                          <Badge variant={entry.is_active ? "default" : "secondary"}>
                            {entry.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {entry.embedding && (
                            <Badge variant="outline">
                              <Zap className="h-3 w-3 mr-1" />
                              Embedded
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.content}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEntryStatus(entry.id, entry.is_active)}
                        >
                          {entry.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingEntry(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEntry(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="add" className="space-y-4">
              <div className="space-y-4">
                <Input
                  placeholder="Entry title"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({...newEntry, title: e.target.value})}
                />
                <Select value={newEntry.category} onValueChange={(value) => setNewEntry({...newEntry, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Entry content"
                  rows={6}
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({...newEntry, content: e.target.value})}
                />
                <Button onClick={addEntry} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="p-4 bg-muted rounded-lg text-left">
                  <h3 className="font-medium mb-2">Bulk Import Instructions:</h3>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>Edit <code>src/utils/bulkKnowledgeImport.ts</code> with your content</li>
                    <li>Add your knowledge base entries to the array</li>
                    <li>Use categories: general, policy, sizing, shipping, returns, loyalty, discount, technical</li>
                    <li>Click "Import Sample Data" or add your custom entries</li>
                  </ol>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Button onClick={handleBulkImport} variant="default">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Sample Data
                  </Button>
                  <Button onClick={handleClearAll} variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Entries
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Note: After importing, remember to generate embeddings in the Embeddings tab
                </div>
              </div>
            </TabsContent>

            <TabsContent value="embeddings" className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Generate vector embeddings for all knowledge base entries to enable semantic search.
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-sm">
                    <span className="font-medium">Total Entries:</span> {entries.length}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">With Embeddings:</span> {entries.filter(e => e.embedding).length}
                  </div>
                </div>
                <Button onClick={generateEmbeddings} disabled={isGenerating} size="lg">
                  <Zap className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Embeddings'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Knowledge Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={editingEntry.title}
                onChange={(e) => setEditingEntry({...editingEntry, title: e.target.value})}
              />
              <Select value={editingEntry.category} onValueChange={(value) => setEditingEntry({...editingEntry, category: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                rows={8}
                value={editingEntry.content}
                onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
                <Button onClick={updateEntry}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};