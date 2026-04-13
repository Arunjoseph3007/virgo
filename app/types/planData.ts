export type ChangeAction = "no-op" | "create" | "delete" | "update" | "replace";

export interface PlannedOutput {
  sensitive: boolean;
  type: string;
  value: unknown;
}

export interface Resource {
  address: string;
  mode: "managed" | "data";
  type: string;
  name: string;
  provider_name: string;
  schema_version: number;
  values: Record<string, unknown>;
  sensitive_values: Record<string, unknown>;
}

export interface Module {
  resources: Resource[];
  child_modules?: ChildModule[];
}

export interface ChildModule {
  address: string;
  resources: Resource[];
  child_modules?: ChildModule[];
}

export interface PlannedValues {
  outputs: Record<string, PlannedOutput>;
  root_module: Module;
}

export interface ResourceChange {
  address: string;
  mode: "managed" | "data";
  type: string;
  name: string;
  provider_name: string;
  change: Change;
  action_reason?: string;
}

export interface Change {
  actions: ChangeAction[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  after_unknown: Record<string, unknown>;
  before_sensitive: Record<string, unknown>;
  after_sensitive: Record<string, unknown>;
  replace_paths?: string[][];
}

export interface OutputChange {
  actions: ChangeAction[];
  before: unknown;
  after: unknown;
  after_unknown: boolean | Record<string, unknown>;
  before_sensitive: boolean | Record<string, unknown>;
  after_sensitive: boolean | Record<string, unknown>;
}

export interface StateValues {
  outputs: Record<string, PlannedOutput>;
  root_module: Module;
}

export interface PriorState {
  format_version: string;
  terraform_version: string;
  values: StateValues;
}

export interface ProviderConfig {
  name: string;
  full_name: string;
}

export interface Expression {
  references?: string[];
  constant_value?: unknown;
}

export interface Provisioner {
  type: string;
  expressions: Record<string, Expression>;
}

export interface ConfigResource {
  address: string;
  mode: "managed" | "data";
  type: string;
  name: string;
  provider_config_key: string;
  expressions: Record<string, Expression>;
  schema_version: number;
  provisioners?: Provisioner[];
}

export interface ConfigOutput {
  expression: Expression;
}

export interface ConfigVariable {
  default?: unknown;
  description?: string;
}

export interface ConfigModule {
  outputs?: Record<string, ConfigOutput>;
  resources?: ConfigResource[];
  variables?: Record<string, ConfigVariable>;
}

export interface Configuration {
  provider_config: Record<string, ProviderConfig>;
  root_module: ConfigModule;
}

export interface TerraformPlanData {
  format_version: string;
  terraform_version: string;
  variables: Record<string, { value: unknown }>;
  planned_values: PlannedValues;
  resource_changes: ResourceChange[];
  output_changes: Record<string, OutputChange>;
  prior_state: PriorState;
  configuration: Configuration;
  timestamp: string;
  applyable: boolean;
  complete: boolean;
  errored: boolean;
}
