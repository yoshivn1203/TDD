const pagination = (req, res, next) => {
  const pageAsNumber = req.query.page * 1;
  const sizeAsNumber = req.query.size * 1;

  let page = Number.isNaN(pageAsNumber) ? 0 : pageAsNumber;
  if (page < 0) {
    page = 0;
  }
  let size = Number.isNaN(sizeAsNumber) ? 0 : sizeAsNumber;
  if (size < 1 || size > 10) {
    size = 10;
  }
  req.pagination = { size: size, page: page };
  next();
};

module.exports = pagination;
