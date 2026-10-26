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
  types: NamedType[];
  auth: AuthScheme[];
}

export type AuthScheme =
  | ApiKeyAuth
  | HttpAuth;

export interface ApiKeyAuth {
  kind: "apiKey";
  name: string;
  wireName: string;
  location: "header" | "query" | "cookie";
}

export interface HttpAuth {
  kind: "http";
  name: string;
  scheme: string;
  bearerFormat?: string;
}

export interface NamedType {
  name: string;
  description?: string;
  type: TypeReference;
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
  | ObjectType
  | EnumType
  | UnionType
  | IntersectionType
  | UnknownType;

export interface PrimitiveType {
  kind: "primitive";
  type: "string" | "number" | "integer" | "boolean";
  nullable?: boolean;
}

export interface IntersectionType {
  kind: "intersection";
  variants: TypeReference[];
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

export interface ObjectType {
  kind: "object";
  properties: ObjectProperty[];
  nullable?: boolean;
}

export interface ObjectProperty {
  name: string;
  wireName: string;
  required: boolean;
  type: TypeReference;
}

export interface UnknownType {
  kind: "unknown";
}

export interface EnumType {
  kind: "enum";
  values: Array<string | number | boolean>;
  nullable?: boolean;
}

export interface UnionType {
  kind: "union";
  variants: TypeReference[];
  nullable?: boolean;
}