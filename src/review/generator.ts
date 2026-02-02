import { LLMProvider } from "../llm/provider";
import { ChatMessage } from "../llm/types";
import { ParsedDiff, ReviewComment, GeneratedReview } from "./types";

export type { ReviewComment, GeneratedReview };

export class ReviewGenerator {
     constructor(private llmProvider: LLMProvider) {}

     async generateReview(
          diff: ParsedDiff,
          prTitle: string,
          ragContext?: string,
     ): Promise<GeneratedReview> {
          const systemPrompt = this.buildSystemPrompt();
          const userPrompt = this.buildUserPrompt(diff, prTitle, ragContext);

          const messages: ChatMessage[] = [
               { role: "system", content: systemPrompt },
               { role: "user", content: userPrompt },
          ];

          const response = await this.llmProvider.chat(messages, {
               maxTokens: 800,
               temperature: 0.1,
          });

          return this.parseReviewResponse(response.content);
     }

     private buildSystemPrompt(): string {
          return `You are an expert code reviewer. Analyze code changes and provide constructive feedback.

Focus on:
- 🔴 Critical: Security vulnerabilities, logic bugs, breaking changes
- 🟡 Warning: Code quality issues, potential bugs, performance concerns
- 🔵 Suggestion: Style improvements, best practices, optimizations

For each issue found, provide:
1. Severity level (critical/warning/suggestion)
2. Confidence score (0-100)
3. Clear explanation
4. Suggested fix when applicable

Be concise and actionable. Only flag significant issues.`;
     }

     private buildUserPrompt(
          diff: ParsedDiff,
          prTitle: string,
          ragContext?: string,
     ): string {
          let prompt = `Review this pull request:

**Title**: ${prTitle}

**Changes Summary**:
- ${diff.additions} additions, ${diff.deletions} deletions
- ${diff.files.length} files changed

${
     ragContext
          ? `**Repository Context**:
${ragContext}

`
          : ""
}**Diff**:
\`\`\`diff
${diff.content}
\`\`\`

Provide your review as structured feedback${ragContext ? ", considering the provided repository context for better understanding of the codebase" : ""}.`;

          return prompt;
     }

     private parseReviewResponse(content: string): GeneratedReview {
          // Simple parsing - in production, you'd want structured JSON output
          const lines = content.split("\n");
          const comments: ReviewComment[] = [];

          let currentComment: Partial<ReviewComment> = {};

          for (const line of lines) {
               if (line.includes("🔴") || line.includes("CRITICAL")) {
                    if (currentComment.message)
                         comments.push(currentComment as ReviewComment);
                    currentComment = { severity: "critical", confidence: 85 };
               } else if (line.includes("🟡") || line.includes("WARNING")) {
                    if (currentComment.message)
                         comments.push(currentComment as ReviewComment);
                    currentComment = { severity: "warning", confidence: 75 };
               } else if (line.includes("🔵") || line.includes("SUGGESTION")) {
                    if (currentComment.message)
                         comments.push(currentComment as ReviewComment);
                    currentComment = { severity: "suggestion", confidence: 65 };
               } else if (line.trim()) {
                    currentComment.message =
                         (currentComment.message || "") + line + "\n";
               }
          }

          if (currentComment.message) {
               comments.push(currentComment as ReviewComment);
          }

          // Determine overall rating
          const hasCritical = comments.some((c) => c.severity === "critical");
          const hasWarning = comments.some((c) => c.severity === "warning");

          let overallRating: "approve" | "request_changes" | "comment";
          if (hasCritical) {
               overallRating = "request_changes";
          } else if (hasWarning) {
               overallRating = "comment";
          } else {
               overallRating = "approve";
          }

          return {
               summary: content.substring(0, 200) + "...",
               comments,
               overallRating,
          };
     }
}
