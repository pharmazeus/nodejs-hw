import { Router } from 'express';
import { celebrate } from 'celebrate';
import {
  createNoteSchema,
  noteIdSchema,
  updateNoteSchema,
} from '../validations/notesValidation.js';
import {
  getNoteById,
  getAllNotes,
  createNote,
  deleteNote,
  updateNote,
} from '../controllers/notesController.js';

const router = Router();

router.get('/notes', getAllNotes);
router.get('/notes/:noteId', celebrate(noteIdSchema), getNoteById);
router.post('/notes', celebrate(createNoteSchema), createNote);
router.delete('/notes/:noteId', celebrate(noteIdSchema), deleteNote);
router.patch('/notes/:noteId', celebrate(updateNoteSchema), updateNote);

export default router;
