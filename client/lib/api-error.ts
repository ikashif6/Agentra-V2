import { AxiosError } from "axios";

type ApiErrorBody = {
  message?: string;
  errors?: { code?: string } | null;
};

export type ParsedApiError = {
  message: string;
  code?: string;
};

export function getApiError(err: unknown, fallback: string): ParsedApiError {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  const data = axiosErr.response?.data;
  const errors = data?.errors;

  if (data?.message) {
    return {
      message: data.message,
      code: errors && typeof errors === "object" && "code" in errors ? errors.code : undefined,
    };
  }

  if (!axiosErr.response) {
    return {
      message: "We couldn't connect right now. Check your internet connection and try again.",
    };
  }

  return { message: fallback };
}
