import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  void req;

  if (file.mimetype.startsWith('image/')) {
    return callback(null, true);
  }

  callback(new Error('Only images allowed'));
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter,
});
