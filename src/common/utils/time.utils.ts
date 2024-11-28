export const elapseTime = () => {
  const startedAt = new Date();
  return () => {
    const end = new Date();
    return end.getTime() - startedAt.getTime();
  };
};
