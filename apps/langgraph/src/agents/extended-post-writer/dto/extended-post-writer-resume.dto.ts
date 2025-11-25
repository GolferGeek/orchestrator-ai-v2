import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

/**
 * Resume DTO for Extended Post Writer HITL
 */
export class ExtendedPostWriterResumeDto {
  @IsString()
  @IsIn(['approve', 'edit', 'reject'])
  decision!: 'approve' | 'edit' | 'reject';

  @IsOptional()
  @IsObject()
  editedContent?: {
    blogPost?: string;
    seoDescription?: string;
    socialPosts?: string[];
  };

  @IsOptional()
  @IsString()
  feedback?: string;
}
