import { ExternalLink, FileText, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OpenNotebookRedirectProps {
  type: 'files' | 'notes';
  teamId?: string;
}

export function OpenNotebookRedirect({ type, teamId }: OpenNotebookRedirectProps) {
  const isFiles = type === 'files';
  const Icon = isFiles ? FileText : BookOpen;

  const handleOpenNotebook = () => {
    // Open Notebook URL - can be configured via environment variable
    const openNotebookUrl = import.meta.env.VITE_OPEN_NOTEBOOK_URL || 'http://localhost:8501';
    const teamParam = teamId ? `?team_id=${teamId}` : '';
    window.open(`${openNotebookUrl}${teamParam}`, '_blank');
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>
            {isFiles ? 'Files Moved to Open Notebook' : 'Notes Moved to Open Notebook'}
          </CardTitle>
          <CardDescription>
            {isFiles
              ? 'All file storage has been consolidated into Open Notebook for better organization, search, and AI-powered insights.'
              : 'All notes are now managed in Open Notebook where you can organize them in notebooks, search with AI, and link them to other content.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button onClick={handleOpenNotebook} className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Open Notebook
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your team content is automatically synced and accessible with the same team permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
