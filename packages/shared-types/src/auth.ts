export interface LoginRequestDto {
  data: {
    email: string;
    password: string;
  };
}

export interface LoginResponseDto {
  status: "success";
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      role: string;
      name: string;
    };
  };
}

export interface CrossAppTokenRequestDto {
  data: {
    applicationId: string;
  };
}

export interface CrossAppTokenResponseDto {
  status: "success";
  data: {
    token: string;
    expiresIn: number;
  };
}

export interface VerifyTokenRequestDto {
  data: {
    token: string;
  };
}

