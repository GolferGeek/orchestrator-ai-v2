import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JourneyTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  template_data: {
    efforts: Array<{
      name: string;
      description?: string;
      icon?: string;
      color?: string;
      estimated_days?: number;
      projects: Array<{
        name: string;
        description?: string;
        tasks: Array<{
          title: string;
          description?: string;
          documentation_url?: string;
          is_milestone?: boolean;
        }>;
      }>;
    }>;
  };
  is_active: boolean;
  created_at: string;
}

// Helper to get orch_flow schema client
const orchFlowSchema = () => supabase.schema('orch_flow');

export function useJourneyTemplates() {
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);

    const { data, error } = await orchFlowSchema()
      .from('journey_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching journey templates:', error);
      setError(error.message);
    } else {
      setTemplates(data || []);
    }

    setLoading(false);
  }, []);

  const getTemplateBySlug = useCallback(async (slug: string) => {
    const { data, error } = await orchFlowSchema()
      .from('journey_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      throw error;
    }

    return data as JourneyTemplate;
  }, []);

  // Apply a template to create efforts/projects/tasks for an organization
  const applyTemplate = useCallback(async (
    templateSlug: string,
    organizationSlug: string
  ) => {
    const template = await getTemplateBySlug(templateSlug);

    if (!template?.template_data?.efforts) {
      throw new Error('Invalid template data');
    }

    // Create efforts, projects, and tasks from template
    for (let effortIndex = 0; effortIndex < template.template_data.efforts.length; effortIndex++) {
      const effortTemplate = template.template_data.efforts[effortIndex];

      // Create effort
      const { data: effort, error: effortError } = await orchFlowSchema()
        .from('efforts')
        .insert({
          organization_slug: organizationSlug,
          name: effortTemplate.name,
          description: effortTemplate.description || null,
          icon: effortTemplate.icon || null,
          color: effortTemplate.color || null,
          estimated_days: effortTemplate.estimated_days || null,
          order_index: effortIndex,
          status: 'not_started',
        })
        .select()
        .single();

      if (effortError) {
        console.error('Error creating effort from template:', effortError);
        throw effortError;
      }

      // Create projects for this effort
      for (let projectIndex = 0; projectIndex < (effortTemplate.projects || []).length; projectIndex++) {
        const projectTemplate = effortTemplate.projects[projectIndex];

        const { data: project, error: projectError } = await orchFlowSchema()
          .from('projects')
          .insert({
            effort_id: effort.id,
            name: projectTemplate.name,
            description: projectTemplate.description || null,
            order_index: projectIndex,
            status: 'not_started',
          })
          .select()
          .single();

        if (projectError) {
          console.error('Error creating project from template:', projectError);
          throw projectError;
        }

        // Create tasks for this project
        for (let taskIndex = 0; taskIndex < (projectTemplate.tasks || []).length; taskIndex++) {
          const taskTemplate = projectTemplate.tasks[taskIndex];

          const { error: taskError } = await orchFlowSchema()
            .from('tasks')
            .insert({
              project_id: project.id,
              title: taskTemplate.title,
              description: taskTemplate.description || null,
              documentation_url: taskTemplate.documentation_url || null,
              is_milestone: taskTemplate.is_milestone || false,
              order_index: taskIndex,
              status: 'pending',
            });

          if (taskError) {
            console.error('Error creating task from template:', taskError);
            throw taskError;
          }
        }
      }
    }

    return true;
  }, [getTemplateBySlug]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    getTemplateBySlug,
    applyTemplate,
  };
}
