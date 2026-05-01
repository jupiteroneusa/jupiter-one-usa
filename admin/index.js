// admin/index.js
export async function buildAdminRouter() {
  const { Router } = await import('express');
  const router = Router();
  router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
  });
  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}