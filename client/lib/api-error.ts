import { AxiosError } from "axios";

type FieldError = {
  field?: string;
  message?: string;
};

type ApiErrorBody = {
  message?: string;
  errors?: FieldError[] | { code?: string } | null;
};

export type ParsedApiError = {
  message: string;
  code?: string;
};

function firstFieldError(errors: ApiErrorBody["errors"]): string | undefined {
  if (!Array.isArray(errors) || !errors.length) return undefined;
  const first = errors[0];
  return typeof first?.message === "string" && first.message.trim() ? first.message : undefined;
}

export function getApiError(err: unknown, fallback: string): ParsedApiError {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  const data = axiosErr.response?.data;
  const errors = data?.errors;
  const fieldMessage = firstFieldError(errors);

  if (fieldMessage) {
    return {
      message: fieldMessage,
      code: undefined,
    };
  }

  if (data?.message) {
    return {
      message: data.message,
      code: errors && typeof errors === "object" && !Array.isArray(errors) && "code" in errors
        ? errors.code
        : undefined,
    };
  }

  if (!axiosErr.response) {
    return {
      message: "We couldn't connect right now. Check your internet connection and try again.",
    };
  }

  return { message: fallback };
}
