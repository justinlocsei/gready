export type ExtractArrayType<T> =
  T extends (infer U)[] ? U :
  T extends readonly (infer U)[] ? U :
  T;
