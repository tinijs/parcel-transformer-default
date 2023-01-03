export function changeConfigs(content: string) {
  return content.replace(
    'configs/development',
    `configs/${process.env.NODE_ENV}`
  );
}
