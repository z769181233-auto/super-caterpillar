export function extractApiErrorMessage(error: any, defaultMessage?: string): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.response?.data?.message) {
    if (Array.isArray(error.response.data.message)) {
      return error.response.data.message.join(', ');
    }
    return error.response.data.message;
  }

  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return defaultMessage || 'An unexpected error occurred';
}
