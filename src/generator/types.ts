export type FileScope =
  | "default"
  | "service"
  | "method"
  | "model"
  | "enum"
  | "copy";

export interface TemplateFile {
  scope: Exclude<FileScope, "copy">;
  destination: string;
  template: string;
}

export interface CopyFile {
  scope: "copy";
  destination: string;
  template: string;
}

export type FileDefinition = TemplateFile | CopyFile;

export interface SDKFilter {
  name: string;
  handler: (...args: unknown[]) => unknown;
}
