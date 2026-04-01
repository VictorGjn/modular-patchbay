/**
 * System Prompt Builder — static/dynamic boundary for prompt caching.
 *
 * Static sections (role, tools, instructions) are cached across calls.
 * Dynamic sections (memory, context, current state) change per call.
 * A boundary marker separates them to maximize prefix cache hits.
 */

export interface PromptSection {
  name: string;
  content: string;
  cacheable: boolean; // true = static, false = dynamic
}

export interface BuiltPrompt {
  sections: PromptSection[];
  fullText: string;
  cacheBreakpoint: number; // char index where dynamic content starts
  staticTokenEstimate: number;
  dynamicTokenEstimate: number;
}

const DYNAMIC_BOUNDARY = '__DYNAMIC_BOUNDARY__';

export class SystemPromptBuilder {
  private sections: PromptSection[] = [];

  /** Add a static (cacheable) section. */
  addStatic(name: string, content: string): this {
    this.sections.push({ name, content, cacheable: true });
    return this;
  }

  /** Add a dynamic (volatile) section. */
  addDynamic(name: string, content: string): this {
    this.sections.push({ name, content, cacheable: false });
    return this;
  }

  /** Insert a section before the target (by name). */
  insertBefore(targetName: string, section: PromptSection): this {
    const idx = this.sections.findIndex(s => s.name === targetName);
    if (idx === -1) {
      throw new Error(`Section "${targetName}" not found`);
    }
    this.sections.splice(idx, 0, section);
    return this;
  }

  /** Remove a section by name. */
  removeSection(name: string): this {
    const idx = this.sections.findIndex(s => s.name === name);
    if (idx !== -1) this.sections.splice(idx, 1);
    return this;
  }

  /** Get a section by name. */
  getSection(name: string): PromptSection | undefined {
    return this.sections.find(s => s.name === name);
  }

  /**
   * Build the final prompt.
   * Static sections always come before dynamic sections.
   * A boundary marker separates the two regions.
   */
  build(): BuiltPrompt {
    const statics = this.sections.filter(s => s.cacheable);
    const dynamics = this.sections.filter(s => !s.cacheable);
    const ordered = [...statics, ...dynamics];

    const staticText = statics
      .map(s => `<${s.name}>\n${s.content}\n</${s.name}>`)
      .join('\n\n');
    const dynamicText = dynamics
      .map(s => `<${s.name}>\n${s.content}\n</${s.name}>`)
      .join('\n\n');

    const fullText = dynamics.length > 0
      ? `${staticText}\n\n${DYNAMIC_BOUNDARY}\n\n${dynamicText}`
      : staticText;

    return {
      sections: ordered,
      fullText,
      cacheBreakpoint: staticText.length,
      staticTokenEstimate: SystemPromptBuilder.estimateTokens(staticText),
      dynamicTokenEstimate: SystemPromptBuilder.estimateTokens(dynamicText),
    };
  }

  /** Estimate tokens from text (words × 1.3). */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.ceil(words * 1.3);
  }
}
