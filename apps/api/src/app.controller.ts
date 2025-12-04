import { Controller, Get, Headers } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('agents')
  async getAgentStatus(
    @Headers('x-organization-slug') organizationSlug?: string,
    @Headers() allHeaders?: Record<string, string>,
  ): Promise<unknown> {
    // Log the received header for debugging
    console.log('🔍 Backend received x-organization-slug header:', organizationSlug);
    console.log('🔍 All headers:', JSON.stringify(allHeaders, null, 2));

    // If organization slug is provided, filter by it
    const organizations = organizationSlug ? [organizationSlug] : undefined;
    const result = await this.appService.getAgentStatus(organizations);

    console.log('🔍 Returning agents:', (result as any)?.agents?.length, 'agents');
    if ((result as any)?.agents?.length > 0) {
      console.log('🔍 First agent org:', (result as any).agents[0].organizationSlug);
    }

    return result;
  }
}
