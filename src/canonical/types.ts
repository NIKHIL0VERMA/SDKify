export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface SDKSpec {
  name: string;
  version: string;
  description?: string;

  servers: Server[];
  services: Service[];
}

export interface Server {
  url: string;
  description?: string;
}

export interface Service {
  name: string;
  description?: string;
  operations: Operation[];
}

export interface Operation {
  name: string;
  operationId: string;

  method: HttpMethod;
  path: string;

  summary?: string;
  description?: string;

  parameters: Parameter[];

  requestBody?: RequestBody;
  response?: Response;
}

export interface Parameter {
  /**
   * SDK-friendly name.
   *
   * customer_id -> customerId
   */
  name: string;

  /**
   * Name sent over HTTP.
   *
   * customerId -> customer_id
   */
  wireName: string;

  location: "path" | "query" | "header" | "cookie";

  required: boolean;
  description?: string;

  type: TypeReference;
}

export interface RequestBody {
  required: boolean;
  contentType: string;
  type: TypeReference;
}

export interface Response {
  statusCode: string;
  contentType?: string;
  type?: TypeReference;
}

export type TypeReference =
  | PrimitiveType
  | ModelType
  | ArrayType
  | UnknownType;

export interface PrimitiveType {
  kind: "primitive";
  type: "string" | "number" | "integer" | "boolean";
  nullable?: boolean;
}

export interface ModelType {
  kind: "model";
  name: string;
  nullable?: boolean;
}

export interface ArrayType {
  kind: "array";
  items: TypeReference;
  nullable?: boolean;
}

export interface UnknownType {
  kind: "unknown";
}