import { Router } from 'express';
import { FileController } from '../controllers/fileController.js';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/:projectId/files', requireProjectRole('viewer'), FileController.getTree);
router.post('/:projectId/files', requireProjectRole('editor'), FileController.createFile);
router.post('/:projectId/folders', requireProjectRole('editor'), FileController.createFolder);
router.put('/:projectId/files/:fileId', requireProjectRole('editor'), FileController.saveFile);
router.patch('/:projectId/nodes/:nodeId', requireProjectRole('editor'), FileController.renameNode);
router.delete('/:projectId/nodes/:nodeId', requireProjectRole('editor'), FileController.deleteNode);
router.post('/:projectId/nodes/:nodeId/duplicate', requireProjectRole('editor'), FileController.duplicateNode);
router.get('/:projectId/search', requireProjectRole('viewer'), FileController.search);

export default router;
