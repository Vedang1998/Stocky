export class TenantAccessError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TenantAccessError";
    this.code = code;
  }
}

export class TenantAuthorityError extends TenantAccessError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "TenantAuthorityError";
  }
}
