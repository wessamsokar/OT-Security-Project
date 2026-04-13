export type AuthFormValues = {
  fullName?: string;
  email: string;
  password: string;
};

export type AuthApiResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    role?: "admin" | "analyst" | "viewer";
  };
};
