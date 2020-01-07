export type ExtractArrayType<T> = T extends (infer U)[] ? U : T;
export type OneOrMore<T> = T | T[];
