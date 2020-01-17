export type ExtractArrayType<T> =
  T extends (infer U)[] ? U :
  T extends readonly (infer U)[] ? U :
  T;

export type Partitioned<T> = {
  data: T;
  percentile: number;
};
