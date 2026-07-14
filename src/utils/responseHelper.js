export const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendPaginated = (res, data, pagination, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

export const sendCreated = (res, data, message = 'Created successfully') => {
  sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res) => {
  res.status(204).send();
};
