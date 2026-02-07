#!/usr/bin/env node
/**
 * Content Templates for Onboarding Scripts
 * 
 * Provides structured content templates for Flow (efforts/projects/tasks)
 * and Notebook (notebooks/documents) based on company size and team type.
 * 
 * All content includes real structure and guidance, not just placeholders.
 */

/**
 * Get Flow content template for a team and company size
 */
function getFlowTemplate(teamType, companySize) {
  const templates = {
    solo: {
      leadership: {
        efforts: [
          {
            name: 'Strategic Foundation',
            description: 'Establish core strategic direction and priorities',
            icon: 'rocket',
            color: '#3b82f6',
            estimatedDays: 7,
            projects: [
              {
                name: 'Define Vision and Goals',
                description: 'Clarify what you want to achieve with AI agents',
                tasks: [
                  {
                    title: 'Document your primary business objectives',
                    description: 'Write down 3-5 key goals you want AI agents to help achieve. Be specific about outcomes you\'re looking for.',
                    isMilestone: true,
                  },
                  {
                    title: 'Identify key use cases',
                    description: 'List specific scenarios where AI agents could add value. Think about repetitive tasks, data analysis, or customer interactions.',
                  },
                  {
                    title: 'Set success metrics',
                    description: 'Define how you\'ll measure success. Examples: time saved, accuracy improved, customer satisfaction increased.',
                  },
                ],
              },
            ],
          },
        ],
      },
      developer: {
        efforts: [
          {
            name: 'Development Setup',
            description: 'Get your development environment ready',
            icon: 'code',
            color: '#10b981',
            estimatedDays: 3,
            projects: [
              {
                name: 'Initial Configuration',
                description: 'Set up basic development tools and access',
                tasks: [
                  {
                    title: 'Verify API access and credentials',
                    description: 'Test your API keys and ensure you can connect to the Orchestrator AI platform. Check authentication works correctly.',
                    isMilestone: true,
                  },
                  {
                    title: 'Set up local development environment',
                    description: 'Install necessary tools (Node.js, Python, or your preferred stack). Configure your IDE with proper extensions.',
                  },
                  {
                    title: 'Clone or access code repositories',
                    description: 'Get access to relevant codebases. Set up version control if needed.',
                  },
                  {
                    title: 'Review API documentation',
                    description: 'Familiarize yourself with available endpoints and authentication methods. Bookmark key documentation pages.',
                  },
                  {
                    title: 'Create your first test connection',
                    description: 'Make a simple API call to verify everything works. Start with a basic "hello world" style request.',
                  },
                ],
              },
              {
                name: 'First Agent',
                description: 'Create and test your first AI agent',
                tasks: [
                  {
                    title: 'Choose a simple use case',
                    description: 'Pick something straightforward for your first agent - maybe data formatting, simple Q&A, or basic automation.',
                    isMilestone: true,
                  },
                  {
                    title: 'Configure agent settings',
                    description: 'Set up the agent\'s name, description, and basic parameters. Choose appropriate model and settings.',
                  },
                  {
                    title: 'Test agent with sample input',
                    description: 'Run your agent with test data. Verify it produces expected outputs.',
                  },
                  {
                    title: 'Handle edge cases',
                    description: 'Test with various inputs including edge cases. Add error handling if needed.',
                  },
                  {
                    title: 'Document your agent',
                    description: 'Write down what the agent does, how to use it, and any important notes for future reference.',
                  },
                ],
              },
            ],
          },
        ],
      },
      hardware: {
        efforts: [
          {
            name: 'Infrastructure Basics',
            description: 'Set up essential hardware and infrastructure',
            icon: 'server',
            color: '#8b5cf6',
            estimatedDays: 5,
            projects: [
              {
                name: 'Initial Hardware Setup',
                description: 'Configure basic hardware requirements',
                tasks: [
                  {
                    title: 'Assess current hardware capabilities',
                    description: 'Review your existing hardware. Check CPU, memory, and storage. Identify any gaps for running AI workloads.',
                    isMilestone: true,
                  },
                  {
                    title: 'Plan infrastructure needs',
                    description: 'Determine what hardware you\'ll need. Consider: local vs cloud, GPU requirements, storage needs, network capacity.',
                  },
                ],
              },
            ],
          },
        ],
      },
      'agent-dev': {
        efforts: [
          {
            name: 'Agent Development Basics',
            description: 'Learn to create and customize agents',
            icon: 'sparkles',
            color: '#f59e0b',
            estimatedDays: 5,
            projects: [
              {
                name: 'First Custom Agent',
                description: 'Build your first custom agent from scratch',
                tasks: [
                  {
                    title: 'Understand agent architecture',
                    description: 'Learn how agents work: inputs, processing, outputs. Review example agents to understand patterns.',
                    isMilestone: true,
                  },
                  {
                    title: 'Design your agent\'s purpose',
                    description: 'Clearly define what your agent should do. Write a simple specification.',
                  },
                  {
                    title: 'Implement core functionality',
                    description: 'Build the main logic for your agent. Start simple and iterate.',
                  },
                  {
                    title: 'Test and refine',
                    description: 'Test your agent thoroughly. Refine based on results. Add error handling.',
                  },
                ],
              },
            ],
          },
        ],
      },
      evangelist: {
        efforts: [
          {
            name: 'Documentation Foundation',
            description: 'Create essential documentation',
            icon: 'book',
            color: '#ef4444',
            estimatedDays: 3,
            projects: [
              {
                name: 'Initial Documentation',
                description: 'Document your setup and processes',
                tasks: [
                  {
                    title: 'Create setup guide',
                    description: 'Document how you set up your environment. Include steps, configurations, and any gotchas you encountered.',
                    isMilestone: true,
                  },
                  {
                    title: 'Document your workflows',
                    description: 'Write down your common workflows. How do you use agents? What processes do you follow?',
                    },
                  ],
                },
              ],
            },
          ],
      },
    },
    smallNoDevs: {
      leadership: {
        efforts: [
          {
            name: 'Strategic Planning',
              description: 'Develop comprehensive AI strategy for your team',
              icon: 'rocket',
              color: '#3b82f6',
              estimatedDays: 14,
              projects: [
                {
                  name: 'Define Team Vision',
                  description: 'Establish clear vision for AI adoption',
                  tasks: [
                    {
                      title: 'Conduct team vision session',
                      description: 'Gather your team to discuss AI goals. What problems are we solving? What opportunities exist?',
                      isMilestone: true,
                    },
                    {
                      title: 'Document strategic objectives',
                      description: 'Write clear, measurable objectives. Align with business goals.',
                    },
                    {
                      title: 'Identify quick wins',
                      description: 'Find 2-3 areas where AI can provide immediate value. Focus on high-impact, low-effort opportunities.',
                    },
                    {
                      title: 'Create roadmap',
                      description: 'Plan your AI adoption journey. Set milestones and timelines.',
                    },
                    {
                      title: 'Define success metrics',
                      description: 'Establish KPIs. How will you measure ROI? What does success look like?',
                    },
                  ],
                },
                {
                  name: 'Team Alignment',
                  description: 'Ensure everyone understands the direction',
                  tasks: [
                    {
                      title: 'Communicate vision to team',
                      description: 'Share your AI strategy with the team. Explain the "why" behind decisions.',
                      isMilestone: true,
                    },
                    {
                      title: 'Assign roles and responsibilities',
                      description: 'Clarify who does what. Define ownership for different aspects.',
                    },
                    {
                      title: 'Set up regular check-ins',
                      description: 'Schedule weekly or bi-weekly meetings to track progress and address questions.',
                    },
                    {
                      title: 'Create feedback channels',
                      description: 'Establish ways for team members to share ideas, concerns, and successes.',
                    },
                    {
                      title: 'Document team processes',
                      description: 'Write down how your team will work together. Define workflows and handoffs.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        developer: {
          efforts: [
            {
              name: 'Basic Technical Setup',
              description: 'Minimal technical configuration for non-developers',
              icon: 'code',
              color: '#10b981',
              estimatedDays: 5,
              projects: [
                {
                  name: 'Platform Access',
                  description: 'Get access to necessary tools',
                  tasks: [
                    {
                      title: 'Set up user accounts',
                      description: 'Create accounts for team members who need platform access. Configure appropriate permissions.',
                      isMilestone: true,
                    },
                    {
                      title: 'Test basic platform features',
                      description: 'Explore the platform interface. Try creating a simple agent or running a basic task.',
                    },
                    {
                      title: 'Learn to use pre-built agents',
                      description: 'Familiarize yourself with available agents. Try using them for common tasks.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        hardware: {
          efforts: [
            {
              name: 'Infrastructure Planning',
              description: 'Plan infrastructure for team use',
              icon: 'server',
              color: '#8b5cf6',
              estimatedDays: 7,
              projects: [
                {
                  name: 'Assess Team Needs',
                  description: 'Understand what infrastructure your team requires',
                  tasks: [
                    {
                      title: 'Evaluate current infrastructure',
                      description: 'Review existing hardware and cloud resources. What do we have? What\'s missing?',
                      isMilestone: true,
                    },
                    {
                      title: 'Plan resource allocation',
                      description: 'Determine how to allocate resources across team members. Consider shared vs individual resources.',
                    },
                    {
                      title: 'Set up access controls',
                      description: 'Configure who can access what. Set up proper security and permissions.',
                    },
                    {
                      title: 'Document infrastructure setup',
                      description: 'Write down how infrastructure is configured. Include access procedures and troubleshooting tips.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        'agent-dev': {
          efforts: [
            {
              name: 'Using Pre-built Agents',
              description: 'Learn to effectively use existing agents',
              icon: 'sparkles',
              color: '#f59e0b',
              estimatedDays: 7,
              projects: [
                {
                  name: 'Agent Discovery',
                  description: 'Find agents that fit your needs',
                  tasks: [
                    {
                      title: 'Explore agent marketplace',
                      description: 'Browse available agents. Read descriptions and use cases.',
                      isMilestone: true,
                    },
                    {
                      title: 'Test relevant agents',
                      description: 'Try out agents that match your use cases. See how they work.',
                    },
                    {
                      title: 'Document agent capabilities',
                      description: 'Create a list of useful agents. Note what each one does and when to use it.',
                    },
                    {
                      title: 'Create usage guidelines',
                      description: 'Write best practices for using agents. Include dos and don\'ts.',
                    },
                  ],
                },
                {
                  name: 'Agent Integration',
                  description: 'Integrate agents into your workflows',
                  tasks: [
                    {
                      title: 'Identify integration points',
                      description: 'Find where agents can fit into your existing processes. Look for automation opportunities.',
                      isMilestone: true,
                    },
                    {
                      title: 'Test workflow integration',
                      description: 'Try using agents in real workflows. See how they fit.',
                    },
                    {
                      title: 'Train team on agent usage',
                      description: 'Share knowledge with your team. Show them how to use agents effectively.',
                    },
                    {
                      title: 'Monitor and optimize',
                      description: 'Track how agents are being used. Look for improvements.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        evangelist: {
          efforts: [
            {
              name: 'Team Documentation',
              description: 'Create comprehensive team documentation',
              icon: 'book',
              color: '#ef4444',
              estimatedDays: 10,
              projects: [
                {
                  name: 'User Guides',
                  description: 'Create guides for team members',
                  tasks: [
                    {
                      title: 'Write getting started guide',
                      description: 'Create a guide for new team members. Include setup steps and first tasks.',
                      isMilestone: true,
                    },
                    {
                      title: 'Document common workflows',
                      description: 'Write step-by-step guides for common tasks. Include screenshots if helpful.',
                    },
                    {
                      title: 'Create troubleshooting guide',
                      description: 'Document common issues and solutions. Help team members solve problems independently.',
                    },
                    {
                      title: 'Build knowledge base',
                      description: 'Organize all documentation in an accessible way. Make it easy to find information.',
                    },
                  ],
                },
                {
                  name: 'Training Materials',
                  description: 'Develop training resources',
                  tasks: [
                    {
                      title: 'Create training curriculum',
                      description: 'Outline what team members need to learn. Structure it logically.',
                      isMilestone: true,
                    },
                    {
                      title: 'Develop training sessions',
                      description: 'Create presentations or workshops. Cover key concepts and hands-on practice.',
                    },
                    {
                      title: 'Record video tutorials',
                      description: 'Create video walkthroughs for complex processes. Make them easy to follow.',
                    },
                    {
                      title: 'Set up practice exercises',
                      description: 'Create hands-on exercises. Let people practice in a safe environment.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      smallWithDevs: {
        leadership: {
          efforts: [
            {
              name: 'Strategic Planning',
              description: 'Develop comprehensive AI strategy',
              icon: 'rocket',
              color: '#3b82f6',
              estimatedDays: 14,
              projects: [
                {
                  name: 'Define Team Vision',
                  description: 'Establish clear vision for AI adoption',
                  tasks: [
                    {
                      title: 'Conduct team vision session',
                      description: 'Gather your team to discuss AI goals. What problems are we solving? What opportunities exist?',
                      isMilestone: true,
                    },
                    {
                      title: 'Document strategic objectives',
                      description: 'Write clear, measurable objectives. Align with business goals.',
                    },
                    {
                      title: 'Identify quick wins',
                      description: 'Find 2-3 areas where AI can provide immediate value. Focus on high-impact, low-effort opportunities.',
                    },
                    {
                      title: 'Create roadmap',
                      description: 'Plan your AI adoption journey. Set milestones and timelines.',
                    },
                    {
                      title: 'Define success metrics',
                      description: 'Establish KPIs. How will you measure ROI? What does success look like?',
                    },
                  ],
                },
                {
                  name: 'Team Alignment',
                  description: 'Ensure everyone understands the direction',
                  tasks: [
                    {
                      title: 'Communicate vision to team',
                      description: 'Share your AI strategy with the team. Explain the "why" behind decisions.',
                      isMilestone: true,
                    },
                    {
                      title: 'Assign roles and responsibilities',
                      description: 'Clarify who does what. Define ownership for different aspects.',
                    },
                    {
                      title: 'Set up regular check-ins',
                      description: 'Schedule weekly or bi-weekly meetings to track progress and address questions.',
                    },
                    {
                      title: 'Create feedback channels',
                      description: 'Establish ways for team members to share ideas, concerns, and successes.',
                    },
                    {
                      title: 'Document team processes',
                      description: 'Write down how your team will work together. Define workflows and handoffs.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        developer: {
          efforts: [
            {
              name: 'Development Setup',
              description: 'Set up comprehensive development environment',
              icon: 'code',
              color: '#10b981',
              estimatedDays: 7,
              projects: [
                {
                  name: 'Initial Configuration',
                  description: 'Set up development tools and access',
                  tasks: [
                    {
                      title: 'Verify API access and credentials',
                      description: 'Test your API keys and ensure you can connect to the Orchestrator AI platform. Check authentication works correctly.',
                      isMilestone: true,
                    },
                    {
                      title: 'Set up local development environment',
                      description: 'Install necessary tools (Node.js, Python, or your preferred stack). Configure your IDE with proper extensions.',
                    },
                    {
                      title: 'Clone or access code repositories',
                      description: 'Get access to relevant codebases. Set up version control if needed.',
                    },
                    {
                      title: 'Review API documentation',
                      description: 'Familiarize yourself with available endpoints and authentication methods. Bookmark key documentation pages.',
                    },
                    {
                      title: 'Create your first test connection',
                      description: 'Make a simple API call to verify everything works. Start with a basic "hello world" style request.',
                    },
                  ],
                },
                {
                  name: 'First Agent',
                  description: 'Create and test your first AI agent',
                  tasks: [
                    {
                      title: 'Choose a simple use case',
                      description: 'Pick something straightforward for your first agent - maybe data formatting, simple Q&A, or basic automation.',
                      isMilestone: true,
                    },
                    {
                      title: 'Configure agent settings',
                      description: 'Set up the agent\'s name, description, and basic parameters. Choose appropriate model and settings.',
                    },
                    {
                      title: 'Test agent with sample input',
                      description: 'Run your agent with test data. Verify it produces expected outputs.',
                    },
                    {
                      title: 'Handle edge cases',
                      description: 'Test with various inputs including edge cases. Add error handling if needed.',
                    },
                    {
                      title: 'Document your agent',
                      description: 'Write down what the agent does, how to use it, and any important notes for future reference.',
                    },
                  ],
                },
                {
                  name: 'Custom Agent Development',
                  description: 'Build custom agents for your needs',
                  tasks: [
                    {
                      title: 'Identify custom agent requirements',
                      description: 'Determine what custom agents you need. What can\'t pre-built agents do?',
                      isMilestone: true,
                    },
                    {
                      title: 'Design agent architecture',
                      description: 'Plan how your custom agent will work. Define inputs, processing, and outputs.',
                    },
                    {
                      title: 'Implement core functionality',
                      description: 'Build the main logic. Use best practices and clean code principles.',
                    },
                    {
                      title: 'Add error handling',
                      description: 'Implement robust error handling. Handle edge cases gracefully.',
                    },
                    {
                      title: 'Write tests',
                      description: 'Create unit and integration tests. Ensure your agent works correctly.',
                    },
                    {
                      title: 'Document the agent',
                      description: 'Write comprehensive documentation. Include usage examples and API reference.',
                    },
                  ],
                },
                {
                  name: 'Integration Patterns',
                  description: 'Learn to integrate agents into systems',
                  tasks: [
                    {
                      title: 'Study integration examples',
                      description: 'Review how other teams integrate agents. Learn from best practices.',
                      isMilestone: true,
                    },
                    {
                      title: 'Design integration architecture',
                      description: 'Plan how agents will integrate with your systems. Consider APIs, webhooks, and data flows.',
                    },
                    {
                      title: 'Implement first integration',
                      description: 'Build your first integration. Start simple and iterate.',
                    },
                    {
                      title: 'Test integration thoroughly',
                      description: 'Test all integration points. Verify data flows correctly.',
                    },
                    {
                      title: 'Monitor integration performance',
                      description: 'Set up monitoring and logging. Track performance metrics.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        hardware: {
          efforts: [
            {
              name: 'Infrastructure Setup',
              description: 'Set up and optimize infrastructure',
              icon: 'server',
              color: '#8b5cf6',
              estimatedDays: 10,
              projects: [
                {
                  name: 'Infrastructure Planning',
                  description: 'Plan your infrastructure needs',
                  tasks: [
                    {
                      title: 'Assess current infrastructure',
                      description: 'Review existing hardware and cloud resources. What do we have? What\'s missing?',
                      isMilestone: true,
                    },
                    {
                      title: 'Plan resource allocation',
                      description: 'Determine how to allocate resources across team members. Consider shared vs individual resources.',
                    },
                    {
                      title: 'Design infrastructure architecture',
                      description: 'Plan your infrastructure layout. Consider scalability and redundancy.',
                    },
                    {
                      title: 'Estimate costs',
                      description: 'Calculate infrastructure costs. Plan budget accordingly.',
                    },
                  ],
                },
                {
                  name: 'Infrastructure Implementation',
                  description: 'Set up and configure infrastructure',
                  tasks: [
                    {
                      title: 'Set up access controls',
                      description: 'Configure who can access what. Set up proper security and permissions.',
                      isMilestone: true,
                    },
                    {
                      title: 'Configure monitoring',
                      description: 'Set up monitoring and alerting. Track resource usage and performance.',
                    },
                    {
                      title: 'Implement backup strategy',
                      description: 'Set up backups. Test restore procedures.',
                    },
                    {
                      title: 'Document infrastructure setup',
                      description: 'Write down how infrastructure is configured. Include access procedures and troubleshooting tips.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        'agent-dev': {
          efforts: [
            {
              name: 'Agent Development',
              description: 'Build and customize agents',
              icon: 'sparkles',
              color: '#f59e0b',
              estimatedDays: 14,
              projects: [
                {
                  name: 'First Custom Agent',
                  description: 'Build your first custom agent',
                  tasks: [
                    {
                      title: 'Understand agent architecture',
                      description: 'Learn how agents work: inputs, processing, outputs. Review example agents to understand patterns.',
                      isMilestone: true,
                    },
                    {
                      title: 'Design your agent\'s purpose',
                      description: 'Clearly define what your agent should do. Write a simple specification.',
                    },
                    {
                      title: 'Implement core functionality',
                      description: 'Build the main logic for your agent. Start simple and iterate.',
                    },
                    {
                      title: 'Test and refine',
                      description: 'Test your agent thoroughly. Refine based on results. Add error handling.',
                    },
                  ],
                },
                {
                  name: 'Production-Ready Agents',
                  description: 'Build agents ready for production use',
                  tasks: [
                    {
                      title: 'Implement production patterns',
                      description: 'Use production best practices: error handling, logging, monitoring.',
                      isMilestone: true,
                    },
                    {
                      title: 'Add comprehensive testing',
                      description: 'Write thorough tests. Cover edge cases and error scenarios.',
                    },
                    {
                      title: 'Optimize performance',
                      description: 'Profile and optimize your agent. Improve response times and resource usage.',
                    },
                    {
                      title: 'Set up monitoring',
                      description: 'Implement logging and monitoring. Track usage and performance.',
                    },
                    {
                      title: 'Create deployment pipeline',
                      description: 'Set up CI/CD for agent deployment. Automate testing and deployment.',
                    },
                    {
                      title: 'Document thoroughly',
                      description: 'Write comprehensive documentation. Include API reference and usage examples.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        evangelist: {
          efforts: [
            {
              name: 'Documentation and Training',
              description: 'Create comprehensive documentation and training',
              icon: 'book',
              color: '#ef4444',
              estimatedDays: 14,
              projects: [
                {
                  name: 'Technical Documentation',
                  description: 'Create technical docs for developers',
                  tasks: [
                    {
                      title: 'Write API documentation',
                      description: 'Document all APIs. Include request/response examples and error handling.',
                      isMilestone: true,
                    },
                    {
                      title: 'Create architecture diagrams',
                      description: 'Visualize system architecture. Show how components interact.',
                    },
                    {
                      title: 'Document development workflows',
                      description: 'Explain how to develop and deploy agents. Include best practices.',
                    },
                    {
                      title: 'Write troubleshooting guides',
                      description: 'Document common issues and solutions. Help developers solve problems.',
                    },
                  ],
                },
                {
                  name: 'User Documentation',
                  description: 'Create guides for end users',
                  tasks: [
                    {
                      title: 'Write user guides',
                      description: 'Create guides for non-technical users. Make them clear and easy to follow.',
                      isMilestone: true,
                    },
                    {
                      title: 'Create video tutorials',
                      description: 'Record video walkthroughs. Show common tasks step-by-step.',
                    },
                    {
                      title: 'Build FAQ',
                      description: 'Compile frequently asked questions. Provide clear answers.',
                    },
                    {
                      title: 'Create quick reference guides',
                      description: 'Make cheat sheets for common tasks. Quick lookup for users.',
                    },
                  ],
                },
                {
                  name: 'Training Program',
                  description: 'Develop training curriculum',
                  tasks: [
                    {
                      title: 'Create training curriculum',
                      description: 'Outline what people need to learn. Structure it logically.',
                      isMilestone: true,
                    },
                    {
                      title: 'Develop training sessions',
                      description: 'Create presentations or workshops. Cover key concepts and hands-on practice.',
                    },
                    {
                      title: 'Set up practice exercises',
                      description: 'Create hands-on exercises. Let people practice in a safe environment.',
                    },
                    {
                      title: 'Establish certification process',
                      description: 'Define how people demonstrate competency. Create assessment criteria.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };

  const sizeKey = companySize === 'solo' ? 'solo' : 
                  companySize === 'small-no-devs' ? 'smallNoDevs' : 
                  'smallWithDevs';

  return templates[sizeKey]?.[teamType] || templates[sizeKey]?.generic || { efforts: [] };
}

/**
 * Get Notebook content template for a team and company size
 */
function getNotebookTemplate(teamType, companySize) {
  const templates = {
    solo: {
      leadership: {
        notebooks: [
          {
            name: 'Strategic Planning Guide',
            description: 'Essential guides for strategic planning and decision-making',
            documents: [
              {
                title: 'Getting Started with Strategic Planning',
                filename: 'strategic-planning-guide.md',
                content: `# Strategic Planning Guide

## Introduction

Strategic planning is essential for successfully adopting AI agents in your organization. This guide will help you establish a clear vision and roadmap.

## Understanding Your Goals

Before diving into AI agents, take time to clearly define what you want to achieve:

### Key Questions to Answer

1. **What problems are you trying to solve?**
   - Identify pain points in your current processes
   - Look for repetitive tasks that could be automated
   - Consider areas where accuracy or speed could be improved

2. **What opportunities exist?**
   - Think about new capabilities AI agents could enable
   - Consider competitive advantages
   - Explore innovative use cases

3. **What does success look like?**
   - Define measurable outcomes
   - Set realistic timelines
   - Identify key stakeholders

## Creating Your Vision

### Step 1: Document Your Objectives

Write down 3-5 primary objectives. Be specific:

- ❌ Bad: "Use AI to improve things"
- ✅ Good: "Reduce customer response time by 50% using AI-powered support agents"

### Step 2: Identify Quick Wins

Find 2-3 areas where AI can provide immediate value:

- High impact
- Low effort
- Clear success metrics

### Step 3: Build Your Roadmap

Create a timeline with milestones:

- **Month 1**: Initial setup and first agent
- **Month 2-3**: Expand to 2-3 use cases
- **Month 4-6**: Scale successful patterns

## Setting Success Metrics

Define how you'll measure success:

- **Time saved**: Hours per week/month
- **Accuracy improvements**: Error reduction percentage
- **Cost savings**: Dollar amounts
- **User satisfaction**: Survey scores

## Next Steps

1. Review this guide with your team
2. Schedule a vision session
3. Document your strategic objectives
4. Create your initial roadmap

Remember: Start small, learn, and iterate.`,
              },
            ],
          },
        ],
        developer: {
          notebooks: [
            {
              name: 'Developer Getting Started',
              description: 'Essential guides for developers building with AI agents',
              documents: [
                {
                  title: 'Development Setup Guide',
                  filename: 'development-setup.md',
                  content: `# Development Setup Guide

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ or Python 3.9+ installed
- A code editor (VS Code recommended)
- Git installed and configured
- Access to Orchestrator AI platform

## Initial Setup

### Step 1: Verify API Access

1. Log into the Orchestrator AI platform
2. Navigate to Settings > API Keys
3. Generate or copy your API key
4. Store it securely (use environment variables, never commit to git)

### Step 2: Test Your Connection

Create a simple test script:

\`\`\`javascript
// test-connection.js
const axios = require('axios');

async function testConnection() {
  try {
    const response = await axios.get('https://api.orchestratorai.io/health', {
      headers: {
        'Authorization': \`Bearer \${process.env.API_KEY}\`
      }
    });
    console.log('✅ Connection successful!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
\`\`\`

### Step 3: Set Up Your Development Environment

1. Create a project directory
2. Initialize your project (npm init or pip install)
3. Install required dependencies
4. Set up environment variables

## Creating Your First Agent

### Basic Agent Structure

\`\`\`javascript
const agent = {
  name: 'my-first-agent',
  description: 'A simple agent that processes text',
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  // ... configuration
};
\`\`\`

### Testing Your Agent

Always test with sample data first:

1. Start with simple inputs
2. Verify outputs match expectations
3. Test edge cases
4. Add error handling

## Best Practices

- **Version Control**: Always use git
- **Environment Variables**: Never hardcode secrets
- **Error Handling**: Always handle errors gracefully
- **Documentation**: Document your code
- **Testing**: Write tests for your agents

## Next Steps

1. Review the API documentation
2. Create your first test agent
3. Experiment with different models
4. Build your first production agent`,
                },
                {
                  title: 'API Reference Quick Start',
                  filename: 'api-quick-reference.md',
                  content: `# API Quick Reference

## Authentication

All API requests require authentication:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Common Endpoints

### Create Agent

\`\`\`
POST /api/agents
Content-Type: application/json

{
  "name": "agent-name",
  "description": "Agent description",
  "model": "gpt-4"
}
\`\`\`

### Run Agent

\`\`\`
POST /api/agents/{id}/run
Content-Type: application/json

{
  "input": "Your input text",
  "options": {}
}
\`\`\`

### Get Agent Status

\`\`\`
GET /api/agents/{id}/status
\`\`\`

## Error Handling

Always check response status:

\`\`\`javascript
if (response.status === 200) {
  // Success
} else {
  // Handle error
  console.error('Error:', response.data);
}
\`\`\`

## Rate Limits

- Free tier: 100 requests/hour
- Pro tier: 1000 requests/hour

## Support

For help, check:
- API Documentation: https://docs.orchestratorai.io
- Community Forum: https://forum.orchestratorai.io`,
                },
              ],
            },
          ],
        },
        hardware: {
          notebooks: [
            {
              name: 'Infrastructure Guide',
              description: 'Hardware and infrastructure setup guides',
              documents: [
                {
                  title: 'Hardware Requirements',
                  filename: 'hardware-requirements.md',
                  content: `# Hardware Requirements

## Minimum Requirements

For basic AI agent development:

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space
- **Network**: Stable internet connection

## Recommended Setup

For optimal performance:

- **CPU**: 8+ cores
- **RAM**: 32GB
- **Storage**: 100GB+ SSD
- **GPU**: Optional, but helpful for local models

## Cloud vs Local

### Local Development
- Full control
- No API costs
- Requires powerful hardware
- More setup complexity

### Cloud Development
- Lower hardware requirements
- Pay-as-you-go
- Easier to scale
- Requires internet connection

## Next Steps

1. Assess your current hardware
2. Decide on local vs cloud
3. Set up your chosen environment
4. Test with a simple agent`,
                },
              ],
            },
          ],
        },
        'agent-dev': {
          notebooks: [
            {
              name: 'Agent Development Guide',
              description: 'Comprehensive guide to building custom agents',
              documents: [
                {
                  title: 'Building Your First Agent',
                  filename: 'building-first-agent.md',
                  content: `# Building Your First Agent

## Understanding Agents

An AI agent is a program that:
1. Receives input
2. Processes it using AI models
3. Returns output
4. Can take actions based on results

## Agent Architecture

### Basic Components

- **Input Handler**: Receives and validates input
- **Processing Logic**: Uses AI models to process
- **Output Formatter**: Formats results
- **Error Handler**: Handles failures gracefully

## Step-by-Step Guide

### Step 1: Define Purpose

Clearly define what your agent should do:

- What problem does it solve?
- What inputs does it accept?
- What outputs should it produce?

### Step 2: Choose Model

Select appropriate AI model:

- **GPT-4**: Best for complex reasoning
- **GPT-3.5**: Good balance of cost and capability
- **Claude**: Excellent for long-form content

### Step 3: Design Prompts

Create effective prompts:

- Be specific about desired output
- Include examples when helpful
- Set clear constraints

### Step 4: Implement Logic

Build your agent:

\`\`\`javascript
async function processInput(input) {
  // Validate input
  if (!input) throw new Error('Input required');
  
  // Process with AI
  const result = await callAI(input);
  
  // Format output
  return formatOutput(result);
}
\`\`\`

### Step 5: Test Thoroughly

Test with various inputs:
- Normal cases
- Edge cases
- Error cases

## Best Practices

- Start simple, iterate
- Handle errors gracefully
- Log important events
- Document your code
- Test extensively

## Next Steps

1. Build your first agent
2. Test with real data
3. Refine based on results
4. Deploy to production`,
                },
              ],
            },
          ],
        },
        evangelist: {
          notebooks: [
            {
              name: 'Documentation Guide',
              description: 'How to create effective documentation',
              documents: [
                {
                  title: 'Documentation Best Practices',
                  filename: 'documentation-best-practices.md',
                  content: `# Documentation Best Practices

## Why Documentation Matters

Good documentation:
- Saves time for future you
- Helps team members learn
- Reduces support burden
- Enables knowledge sharing

## What to Document

### Essential Documentation

1. **Setup Guides**: How to get started
2. **User Guides**: How to use features
3. **API Reference**: Technical details
4. **Troubleshooting**: Common issues

## Writing Effective Docs

### Structure

- Clear headings
- Logical flow
- Step-by-step instructions
- Examples

### Style

- Use simple language
- Be concise but complete
- Include screenshots when helpful
- Keep it up to date

## Documentation Tools

- **Markdown**: Easy to write and version
- **Wiki**: Collaborative editing
- **Video**: Great for tutorials
- **Interactive**: Code examples

## Next Steps

1. Start documenting as you go
2. Review and update regularly
3. Get feedback from users
4. Continuously improve`,
                },
              ],
            },
        ],
      },
    },
    smallNoDevs: {
        leadership: {
          notebooks: [
            {
              name: 'Strategic Planning Hub',
              description: 'Comprehensive strategic planning resources',
              documents: [
                {
                  title: 'AI Strategy Development',
                  filename: 'ai-strategy-development.md',
                  content: `# AI Strategy Development

## Introduction

Developing a clear AI strategy is crucial for successful adoption. This guide will help you create a comprehensive strategy for your team.

## Phase 1: Assessment

### Current State Analysis

1. **Evaluate Current Processes**
   - Document existing workflows
   - Identify pain points
   - Measure current performance

2. **Assess Team Readiness**
   - Technical skills assessment
   - Change readiness evaluation
   - Resource availability

3. **Review Available Tools**
   - Explore platform capabilities
   - Understand agent marketplace
   - Identify integration opportunities

## Phase 2: Vision and Goals

### Creating Your Vision

Your AI vision should answer:
- Where do we want to be in 6 months?
- What problems will we solve?
- How will this transform our work?

### Setting Goals

Create SMART goals:
- **Specific**: Clear and well-defined
- **Measurable**: Can track progress
- **Achievable**: Realistic given resources
- **Relevant**: Aligns with business objectives
- **Time-bound**: Has clear deadlines

### Example Goals

- Reduce manual data entry by 80% within 3 months
- Improve customer response time by 50% in 6 months
- Automate 5 repetitive workflows by end of quarter

## Phase 3: Roadmap

### Building Your Roadmap

Create a phased approach:

**Phase 1 (Months 1-2): Foundation**
- Team training
- Initial agent deployment
- Process documentation

**Phase 2 (Months 3-4): Expansion**
- Scale successful agents
- Integrate into workflows
- Measure impact

**Phase 3 (Months 5-6): Optimization**
- Refine and improve
- Expand to new use cases
- Build internal expertise

## Phase 4: Implementation

### Quick Wins Strategy

Start with high-impact, low-effort projects:
1. Identify 2-3 quick wins
2. Deploy rapidly
3. Measure results
4. Build momentum

### Risk Management

Identify and mitigate risks:
- Technical challenges
- Change resistance
- Resource constraints
- Integration issues

## Measuring Success

### Key Metrics

- **Efficiency**: Time saved per task
- **Accuracy**: Error reduction
- **Adoption**: Usage rates
- **Satisfaction**: User feedback

### Regular Reviews

- Weekly progress check-ins
- Monthly metrics review
- Quarterly strategy assessment

## Next Steps

1. Conduct team assessment
2. Develop your vision
3. Create roadmap
4. Identify quick wins
5. Begin implementation`,
                },
                {
                  title: 'Team Alignment Guide',
                  filename: 'team-alignment-guide.md',
                  content: `# Team Alignment Guide

## Why Alignment Matters

When your team is aligned:
- Everyone understands the direction
- Efforts are coordinated
- Progress accelerates
- Success is more likely

## Communication Strategy

### Initial Communication

1. **Share the Vision**
   - Explain the "why"
   - Show the benefits
   - Address concerns

2. **Set Expectations**
   - What will change
   - Timeline expectations
   - Role definitions

3. **Create Excitement**
   - Highlight opportunities
   - Show quick wins
   - Celebrate early successes

## Role Definition

### Leadership Role

- Set strategic direction
- Allocate resources
- Remove blockers
- Make decisions

### Team Member Roles

- Execute on strategy
- Provide feedback
- Share knowledge
- Support adoption

## Regular Check-ins

### Weekly Standups

- What did you accomplish?
- What are you working on?
- Any blockers?

### Monthly Reviews

- Progress against goals
- Metrics review
- Strategy adjustments

## Feedback Channels

Create multiple ways for feedback:
- Regular meetings
- Anonymous surveys
- Suggestion box
- One-on-ones

## Next Steps

1. Schedule team meeting
2. Share vision and strategy
3. Define roles clearly
4. Set up regular check-ins`,
                },
              ],
            },
          ],
        },
        developer: {
          notebooks: [
            {
              name: 'Platform User Guide',
              description: 'Guide for using the platform without coding',
              documents: [
                {
                  title: 'Using Pre-built Agents',
                  filename: 'using-prebuilt-agents.md',
                  content: `# Using Pre-built Agents

## Introduction

You don't need to be a developer to use AI agents! This guide shows you how to use pre-built agents effectively.

## Finding Agents

### Agent Marketplace

Browse available agents:
1. Go to Agent Marketplace
2. Browse by category
3. Read descriptions
4. Check ratings and reviews

### Categories

- **Productivity**: Task automation
- **Analysis**: Data processing
- **Content**: Writing and editing
- **Customer Service**: Support automation

## Using an Agent

### Step 1: Select Agent

Choose an agent that matches your need.

### Step 2: Configure Settings

Set basic parameters:
- Input format
- Output preferences
- Quality settings

### Step 3: Provide Input

Enter your data or question.

### Step 4: Review Output

Check the results and refine if needed.

## Best Practices

- Start with simple tasks
- Test with sample data first
- Review outputs carefully
- Provide clear inputs
- Iterate and improve

## Common Use Cases

- **Email Processing**: Sort and categorize emails
- **Data Entry**: Extract information from documents
- **Content Creation**: Generate drafts and summaries
- **Customer Support**: Answer common questions

## Troubleshooting

**Agent not working?**
- Check your input format
- Review agent requirements
- Try simpler input
- Contact support

## Next Steps

1. Explore the marketplace
2. Try a simple agent
3. Build confidence
4. Expand to more complex tasks`,
                },
              ],
            },
          ],
        },
        hardware: {
          notebooks: [
            {
              name: 'Infrastructure Planning',
              description: 'Infrastructure setup and planning guides',
              documents: [
                {
                  title: 'Team Infrastructure Setup',
                  filename: 'team-infrastructure-setup.md',
                  content: `# Team Infrastructure Setup

## Planning Your Infrastructure

Before setting up infrastructure, plan carefully:

### Assess Needs

1. **User Count**: How many people will use it?
2. **Workload**: What types of tasks?
3. **Performance**: What response times needed?
4. **Budget**: What can you spend?

### Choose Architecture

**Cloud-Based** (Recommended for most teams):
- Easy to scale
- No hardware management
- Pay-as-you-go
- Professional support

**Hybrid Approach**:
- Cloud for most tasks
- Local for sensitive data
- Best of both worlds

## Setting Up Access

### User Management

1. Create user accounts
2. Set appropriate permissions
3. Organize into teams
4. Configure access controls

### Security

- Use strong passwords
- Enable two-factor authentication
- Regular access reviews
- Monitor usage

## Resource Allocation

### Shared Resources

- Common agents
- Shared storage
- Team notebooks

### Individual Resources

- Personal agents
- Private notebooks
- Custom configurations

## Monitoring

Track usage:
- Resource consumption
- Performance metrics
- Cost tracking
- Usage patterns

## Next Steps

1. Assess your needs
2. Choose architecture
3. Set up access
4. Configure resources
5. Monitor usage`,
                },
              ],
            },
          ],
        },
        'agent-dev': {
          notebooks: [
            {
              name: 'Agent Usage Guide',
              description: 'How to effectively use agents',
              documents: [
                {
                  title: 'Finding and Using Agents',
                  filename: 'finding-using-agents.md',
                  content: `# Finding and Using Agents

## Agent Discovery

### Marketplace Navigation

The agent marketplace is organized by:
- **Category**: Type of task
- **Popularity**: Most used agents
- **Ratings**: User reviews
- **New**: Recently added

### Search Tips

- Use specific keywords
- Filter by category
- Check ratings
- Read descriptions carefully

## Selecting the Right Agent

### Questions to Ask

1. Does it solve my problem?
2. Is it easy to use?
3. What are the requirements?
4. What's the cost?
5. Are there alternatives?

## Using Agents Effectively

### Best Practices

1. **Start Simple**: Begin with basic tasks
2. **Test First**: Try with sample data
3. **Review Outputs**: Always check results
4. **Iterate**: Refine your approach
5. **Learn**: Understand how agents work

### Common Patterns

**Single Agent Workflow**:
- Input → Agent → Output

**Multi-Agent Workflow**:
- Input → Agent 1 → Agent 2 → Output

**Conditional Workflow**:
- Input → Decision → Agent A or B → Output

## Integration into Workflows

### Identify Integration Points

Where can agents fit?
- Start of process
- Middle steps
- End processing
- Quality checks

### Build Workflows

1. Map current process
2. Identify automation opportunities
3. Design new workflow
4. Test thoroughly
5. Deploy gradually

## Troubleshooting

**Agent not working?**
- Check input format
- Verify requirements
- Try different agent
- Contact support

## Next Steps

1. Explore marketplace
2. Try different agents
3. Build workflows
4. Optimize processes`,
                },
                {
                  title: 'Workflow Integration',
                  filename: 'workflow-integration.md',
                  content: `# Workflow Integration

## Understanding Workflows

A workflow is a series of steps that accomplish a task. AI agents can automate parts of workflows.

## Mapping Your Workflows

### Current State

1. Document existing process
2. Identify each step
3. Note time and effort
4. Find pain points

### Future State

1. Identify automation opportunities
2. Design improved workflow
3. Plan integration points
4. Define success metrics

## Integration Strategies

### Full Automation

Replace manual steps entirely:
- Pros: Maximum efficiency
- Cons: Less control

### Assisted Automation

Agents help but humans review:
- Pros: Balance of speed and control
- Cons: Still requires human time

### Hybrid Approach

Mix of automated and manual:
- Pros: Flexibility
- Cons: More complex

## Implementation Steps

1. **Start Small**: One workflow at a time
2. **Test Thoroughly**: Verify it works
3. **Train Team**: Show how to use
4. **Monitor**: Track performance
5. **Iterate**: Improve over time

## Common Integration Patterns

### Pattern 1: Pre-processing
Agent prepares data before human review

### Pattern 2: Post-processing
Agent processes after human input

### Pattern 3: Quality Check
Agent validates human work

## Next Steps

1. Map your workflows
2. Identify opportunities
3. Design integrations
4. Implement gradually`,
                },
              ],
            },
          ],
        },
        evangelist: {
          notebooks: [
            {
              name: 'Team Documentation Hub',
              description: 'Comprehensive documentation resources',
              documents: [
                {
                  title: 'Creating User Guides',
                  filename: 'creating-user-guides.md',
                  content: `# Creating User Guides

## Why User Guides Matter

Good user guides:
- Reduce training time
- Enable self-service
- Improve adoption
- Reduce support burden

## Guide Structure

### Essential Sections

1. **Introduction**: What and why
2. **Prerequisites**: What you need
3. **Step-by-Step**: How to do it
4. **Examples**: Real scenarios
5. **Troubleshooting**: Common issues

## Writing Tips

### Be Clear

- Use simple language
- Avoid jargon
- Be specific
- Include examples

### Be Complete

- Cover all steps
- Don't skip basics
- Include edge cases
- Provide context

### Be Visual

- Use screenshots
- Include diagrams
- Show examples
- Highlight important parts

## Common Guide Types

### Getting Started Guides
- First-time setup
- Basic operations
- Quick wins

### Feature Guides
- Specific features
- Advanced usage
- Tips and tricks

### Troubleshooting Guides
- Common problems
- Solutions
- When to get help

## Review Process

1. Write draft
2. Test with users
3. Get feedback
4. Revise
5. Publish

## Next Steps

1. Identify guide needs
2. Create outline
3. Write content
4. Get feedback
5. Publish and maintain`,
                },
                {
                  title: 'Training Material Development',
                  filename: 'training-material-development.md',
                  content: `# Training Material Development

## Training Strategy

Effective training requires:
- Clear objectives
- Engaging content
- Hands-on practice
- Ongoing support

## Training Formats

### Written Materials
- Guides and manuals
- Quick references
- FAQs

### Video Content
- Screen recordings
- Tutorial videos
- Walkthroughs

### Interactive Sessions
- Workshops
- Hands-on labs
- Q&A sessions

## Creating Training Content

### Step 1: Define Learning Objectives

What should people learn?
- Specific skills
- Knowledge areas
- Competencies

### Step 2: Structure Content

Organize logically:
- Start with basics
- Build complexity
- Include practice
- Assess learning

### Step 3: Make It Engaging

- Use examples
- Tell stories
- Include exercises
- Provide feedback

## Training Delivery

### Self-Paced
- Online courses
- Video tutorials
- Written guides

### Instructor-Led
- Workshops
- Webinars
- One-on-one

### Hybrid
- Mix of formats
- Flexible scheduling
- Ongoing support

## Assessment

Measure learning:
- Quizzes
- Practical exercises
- Projects
- Certifications

## Next Steps

1. Define objectives
2. Create content
3. Deliver training
4. Assess results
5. Iterate`,
                },
              ],
            },
          ],
        },
      },
      smallWithDevs: {
        leadership: {
          notebooks: [
            {
              name: 'Strategic Planning Hub',
              description: 'Comprehensive strategic planning resources',
              documents: [
                {
                  title: 'AI Strategy Development',
                  filename: 'ai-strategy-development.md',
                  content: `# AI Strategy Development

## Introduction

Developing a clear AI strategy is crucial for successful adoption. This guide will help you create a comprehensive strategy for your team.

## Phase 1: Assessment

### Current State Analysis

1. **Evaluate Current Processes**
   - Document existing workflows
   - Identify pain points
   - Measure current performance

2. **Assess Team Readiness**
   - Technical skills assessment
   - Change readiness evaluation
   - Resource availability

3. **Review Available Tools**
   - Explore platform capabilities
   - Understand agent marketplace
   - Identify integration opportunities

## Phase 2: Vision and Goals

### Creating Your Vision

Your AI vision should answer:
- Where do we want to be in 6 months?
- What problems will we solve?
- How will this transform our work?

### Setting Goals

Create SMART goals:
- **Specific**: Clear and well-defined
- **Measurable**: Can track progress
- **Achievable**: Realistic given resources
- **Relevant**: Aligns with business objectives
- **Time-bound**: Has clear deadlines

## Phase 3: Roadmap

### Building Your Roadmap

Create a phased approach:

**Phase 1 (Months 1-2): Foundation**
- Team training
- Initial agent deployment
- Process documentation

**Phase 2 (Months 3-4): Expansion**
- Scale successful agents
- Integrate into workflows
- Measure impact

**Phase 3 (Months 5-6): Optimization**
- Refine and improve
- Expand to new use cases
- Build internal expertise

## Next Steps

1. Conduct team assessment
2. Develop your vision
3. Create roadmap
4. Identify quick wins
5. Begin implementation`,
                },
                {
                  title: 'Team Alignment Guide',
                  filename: 'team-alignment-guide.md',
                  content: `# Team Alignment Guide

## Why Alignment Matters

When your team is aligned:
- Everyone understands the direction
- Efforts are coordinated
- Progress accelerates
- Success is more likely

## Communication Strategy

### Initial Communication

1. **Share the Vision**
   - Explain the "why"
   - Show the benefits
   - Address concerns

2. **Set Expectations**
   - What will change
   - Timeline expectations
   - Role definitions

## Role Definition

### Leadership Role
- Set strategic direction
- Allocate resources
- Remove blockers

### Developer Role
- Build custom solutions
- Integrate systems
- Optimize performance

### Business User Role
- Use agents effectively
- Provide feedback
- Share use cases

## Next Steps

1. Schedule team meeting
2. Share vision and strategy
3. Define roles clearly
4. Set up regular check-ins`,
                },
              ],
            },
          ],
        },
        developer: {
          notebooks: [
            {
              name: 'Developer Documentation',
              description: 'Technical documentation for developers',
              documents: [
                {
                  title: 'API Reference',
                  filename: 'api-reference.md',
                  content: `# API Reference

## Base URL

\`https://api.orchestratorai.io\`

## Authentication

All requests require authentication:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Agents

#### Create Agent
\`\`\`
POST /api/agents
Content-Type: application/json

{
  "name": "agent-name",
  "description": "Agent description",
  "model": "gpt-4",
  "systemPrompt": "You are a helpful assistant"
}
\`\`\`

#### Run Agent
\`\`\`
POST /api/agents/{id}/run
Content-Type: application/json

{
  "input": "Your input",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
\`\`\`

#### Get Agent
\`\`\`
GET /api/agents/{id}
\`\`\`

### Conversations

#### Create Conversation
\`\`\`
POST /api/conversations
Content-Type: application/json

{
  "agentId": "agent-id",
  "title": "Conversation title"
}
\`\`\`

#### Send Message
\`\`\`
POST /api/conversations/{id}/messages
Content-Type: application/json

{
  "content": "Your message"
}
\`\`\`

## Error Handling

All errors follow this format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
\`\`\`

## Rate Limits

- Free: 100 requests/hour
- Pro: 1000 requests/hour
- Enterprise: Custom

## SDKs

### JavaScript/TypeScript
\`\`\`bash
npm install @orchestratorai/sdk
\`\`\`

### Python
\`\`\`bash
pip install orchestratorai
\`\`\`

## Examples

See our GitHub repository for code examples:
https://github.com/orchestratorai/examples`,
                },
                {
                  title: 'Agent Development Guide',
                  filename: 'agent-development-guide.md',
                  content: `# Agent Development Guide

## Agent Architecture

### Core Components

1. **Input Handler**: Validates and processes input
2. **Processing Engine**: Uses AI models
3. **Output Formatter**: Structures results
4. **Error Handler**: Manages failures

## Development Workflow

### Step 1: Design

- Define purpose
- Specify inputs/outputs
- Plan error handling
- Design testing strategy

### Step 2: Implement

- Build core logic
- Add error handling
- Implement logging
- Write tests

### Step 3: Test

- Unit tests
- Integration tests
- End-to-end tests
- Performance tests

### Step 4: Deploy

- Configure environment
- Set up monitoring
- Deploy to production
- Monitor performance

## Best Practices

### Code Quality

- Use TypeScript/type hints
- Follow style guides
- Write clean code
- Document thoroughly

### Error Handling

- Always handle errors
- Provide clear messages
- Log appropriately
- Fail gracefully

### Performance

- Optimize prompts
- Cache when possible
- Monitor latency
- Scale appropriately

## Testing Strategies

### Unit Testing

Test individual components:
\`\`\`javascript
describe('Agent', () => {
  it('should process input correctly', async () => {
    const result = await agent.process('test input');
    expect(result).toBeDefined();
  });
});
\`\`\`

### Integration Testing

Test with real APIs:
- Use test environment
- Mock external services
- Verify data flows
- Check error handling

## Deployment

### Environment Setup

- Development
- Staging
- Production

### CI/CD Pipeline

1. Run tests
2. Build artifacts
3. Deploy to staging
4. Run smoke tests
5. Deploy to production

## Monitoring

Track:
- Request volume
- Response times
- Error rates
- Resource usage

## Next Steps

1. Review architecture
2. Set up development environment
3. Build your first agent
4. Write tests
5. Deploy`,
                },
                {
                  title: 'Integration Patterns',
                  filename: 'integration-patterns.md',
                  content: `# Integration Patterns

## Common Patterns

### Pattern 1: API Integration

Direct API calls from your application:

\`\`\`javascript
const response = await fetch('https://api.orchestratorai.io/agents/run', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agentId: 'my-agent',
    input: userInput
  })
});
\`\`\`

### Pattern 2: Webhook Integration

Receive results via webhooks:

1. Register webhook URL
2. Trigger agent
3. Receive callback
4. Process results

### Pattern 3: SDK Integration

Use official SDKs:

\`\`\`javascript
import { OrchestratorAI } from '@orchestratorai/sdk';

const client = new OrchestratorAI({ apiKey });
const result = await client.agents.run('agent-id', { input: 'test' });
\`\`\`

## Architecture Patterns

### Microservices

Each agent as a service:
- Independent scaling
- Technology flexibility
- Clear boundaries

### Event-Driven

Agents triggered by events:
- Loose coupling
- Scalable
- Resilient

### Request-Response

Synchronous calls:
- Simple
- Predictable
- Lower latency

## Security Considerations

- Authenticate all requests
- Validate inputs
- Encrypt sensitive data
- Monitor for abuse

## Performance Optimization

- Batch requests when possible
- Cache results
- Use async processing
- Optimize prompts

## Next Steps

1. Choose integration pattern
2. Design architecture
3. Implement integration
4. Test thoroughly
5. Monitor performance`,
                },
              ],
            },
          ],
        },
        hardware: {
          notebooks: [
            {
              name: 'Infrastructure Guide',
              description: 'Infrastructure setup and optimization',
              documents: [
                {
                  title: 'Infrastructure Architecture',
                  filename: 'infrastructure-architecture.md',
                  content: `# Infrastructure Architecture

## Architecture Options

### Cloud-First

Recommended for most teams:
- Easy to scale
- No hardware management
- Professional support
- Pay-as-you-go

### Hybrid

Best of both worlds:
- Cloud for most workloads
- Local for sensitive data
- Flexible scaling

### On-Premises

For specific requirements:
- Full control
- Data sovereignty
- Higher complexity
- More maintenance

## Infrastructure Components

### Compute

- **CPU**: Processing power
- **Memory**: RAM for operations
- **GPU**: Optional for local models

### Storage

- **Database**: Agent data
- **File Storage**: Documents
- **Backups**: Data protection

### Network

- **Bandwidth**: API calls
- **Latency**: Response times
- **Security**: Firewalls, VPNs

## Scaling Strategies

### Horizontal Scaling

Add more servers:
- Easy to scale
- Better redundancy
- More complex coordination

### Vertical Scaling

Upgrade hardware:
- Simpler
- Limited by hardware
- Single point of failure

## Monitoring

Track:
- Resource usage
- Performance metrics
- Error rates
- Costs

## Security

- Network security
- Access controls
- Data encryption
- Regular audits

## Next Steps

1. Choose architecture
2. Plan resources
3. Set up infrastructure
4. Configure monitoring
5. Optimize performance`,
                },
              ],
            },
          ],
        },
        'agent-dev': {
          notebooks: [
            {
              name: 'Advanced Agent Development',
              description: 'Advanced guides for building production agents',
              documents: [
                {
                  title: 'Production-Ready Agents',
                  filename: 'production-ready-agents.md',
                  content: `# Production-Ready Agents

## Production Requirements

### Reliability

- Error handling
- Retry logic
- Fallback mechanisms
- Monitoring

### Performance

- Optimized prompts
- Caching strategies
- Async processing
- Resource management

### Security

- Input validation
- Output sanitization
- Access controls
- Audit logging

## Development Checklist

### Before Production

- [ ] Comprehensive error handling
- [ ] Input validation
- [ ] Output validation
- [ ] Logging implemented
- [ ] Monitoring configured
- [ ] Tests written
- [ ] Documentation complete
- [ ] Performance tested
- [ ] Security reviewed

## Error Handling

### Types of Errors

1. **Input Errors**: Invalid input
2. **Processing Errors**: AI model failures
3. **Output Errors**: Invalid results
4. **System Errors**: Infrastructure issues

### Handling Strategy

\`\`\`javascript
try {
  const result = await processInput(input);
  return { success: true, data: result };
} catch (error) {
  logger.error('Processing failed', { error, input });
  return { success: false, error: error.message };
}
\`\`\`

## Performance Optimization

### Prompt Optimization

- Be specific
- Include examples
- Set constraints
- Test variations

### Caching

Cache when possible:
- Similar inputs
- Expensive operations
- Stable results

### Async Processing

For long operations:
- Queue jobs
- Process async
- Notify when done

## Monitoring

Track metrics:
- Request volume
- Response times
- Error rates
- Resource usage

## Deployment

### Staging First

1. Deploy to staging
2. Run smoke tests
3. Verify functionality
4. Deploy to production

### Rollback Plan

Always have a rollback plan:
- Keep previous version
- Test rollback process
- Monitor closely after deploy

## Next Steps

1. Review requirements
2. Implement features
3. Write tests
4. Deploy to staging
5. Deploy to production`,
                },
                {
                  title: 'Agent Testing Guide',
                  filename: 'agent-testing-guide.md',
                  content: `# Agent Testing Guide

## Testing Strategy

### Unit Tests

Test individual components:
- Input validation
- Processing logic
- Output formatting
- Error handling

### Integration Tests

Test with real APIs:
- End-to-end flows
- API interactions
- Data transformations
- Error scenarios

### Performance Tests

Measure:
- Response times
- Throughput
- Resource usage
- Scalability

## Test Data

### Sample Inputs

Create diverse test data:
- Normal cases
- Edge cases
- Error cases
- Boundary conditions

### Expected Outputs

Define expected results:
- Format
- Content
- Quality
- Completeness

## Testing Tools

### Unit Testing

- Jest (JavaScript)
- pytest (Python)
- Your framework's tools

### Integration Testing

- Postman
- curl
- Custom scripts

### Performance Testing

- Load testing tools
- Monitoring tools
- Profiling tools

## Test Coverage

Aim for:
- 80%+ code coverage
- All critical paths
- Error scenarios
- Edge cases

## Continuous Testing

- Run tests on commit
- Pre-deployment checks
- Post-deployment verification
- Regular regression tests

## Next Steps

1. Write unit tests
2. Create integration tests
3. Set up CI/CD
4. Monitor test results`,
                },
              ],
            },
          ],
        },
        evangelist: {
          notebooks: [
            {
              name: 'Technical Documentation',
              description: 'Technical documentation for developers',
              documents: [
                {
                  title: 'API Documentation Guide',
                  filename: 'api-documentation-guide.md',
                  content: `# API Documentation Guide

## Documentation Structure

### Overview

- What the API does
- Key concepts
- Quick start

### Authentication

- How to authenticate
- Getting API keys
- Security best practices

### Endpoints

For each endpoint:
- Description
- Request format
- Response format
- Examples
- Error codes

### Examples

- Common use cases
- Code samples
- Integration patterns

## Writing Effective Docs

### Be Clear

- Use simple language
- Explain concepts
- Provide context
- Include examples

### Be Complete

- Document all endpoints
- Include all parameters
- Show all responses
- Cover error cases

### Be Current

- Keep docs updated
- Version appropriately
- Deprecate clearly
- Migrate guides

## Documentation Tools

- **OpenAPI/Swagger**: API specs
- **Markdown**: Easy to write
- **Interactive**: Try it out
- **Code Examples**: Real code

## Best Practices

- Start with overview
- Use consistent format
- Include examples
- Keep it updated

## Next Steps

1. Document all endpoints
2. Add examples
3. Create quick start
4. Keep it current`,
                },
                {
                  title: 'User Documentation Guide',
                  filename: 'user-documentation-guide.md',
                  content: `# User Documentation Guide

## Documentation Types

### Getting Started

- First steps
- Basic concepts
- Quick wins

### Feature Guides

- How to use features
- Step-by-step instructions
- Tips and tricks

### Troubleshooting

- Common problems
- Solutions
- When to get help

## Writing for Users

### Know Your Audience

- Technical level
- Use cases
- Pain points
- Goals

### Structure Content

- Clear headings
- Logical flow
- Step-by-step
- Examples

### Make It Visual

- Screenshots
- Diagrams
- Videos
- Examples

## Documentation Formats

### Written

- Guides
- FAQs
- References

### Video

- Tutorials
- Walkthroughs
- Demos

### Interactive

- Try it yourself
- Examples
- Sandboxes

## Maintenance

- Review regularly
- Update for changes
- Get user feedback
- Improve continuously

## Next Steps

1. Identify user needs
2. Create content
3. Get feedback
4. Iterate`,
                },
              ],
            },
          ],
        },
      },
    },
  };

  const sizeKey = companySize === 'solo' ? 'solo' : 
                  companySize === 'small-no-devs' ? 'smallNoDevs' : 
                  'smallWithDevs';

  return templates[sizeKey]?.[teamType] || templates[sizeKey]?.generic || { notebooks: [] };
}

module.exports = {
  getFlowTemplate,
  getNotebookTemplate,
};
