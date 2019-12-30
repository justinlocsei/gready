type JSONArray = JSONSerializable[];
type JSONObject = { [member: string]: JSONSerializable; };
type JSONPrimitive = boolean | null | number | string;
export type JSONSerializable = JSONPrimitive | JSONObject | JSONArray;
