export function changeConfigs(content: string) {
  return content.replace(
    /(\/configs\/development)/g,
    `/configs/${process.env.NODE_ENV}`
  );
}
