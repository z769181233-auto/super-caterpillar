export interface AuthResponse {
  success?: boolean;
  data?: {
    message?: string;
  };
  message?: string | string[];
  error?: {
    message?: string | string[];
  };
}

export async function parseAuthResponse(response: Response): Promise<AuthResponse | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as AuthResponse;
  } catch {
    return {
      message: text,
    };
  }
}
