export const buildPagination = (page = 1, limit = 20, total = 0) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return {
    page: p,
    limit: l,
    total,
    pages: Math.ceil(total / l) || 0,
    skip: (p - 1) * l,
  };
};

export const buildSort = (sortStr = '-createdAt') => {
  const sort = {};
  const fields = sortStr.split(',');
  for (const field of fields) {
    if (field.startsWith('-')) {
      sort[field.slice(1)] = -1;
    } else {
      sort[field] = 1;
    }
  }
  return sort;
};

export const buildSearchFilter = (search, fields = []) => {
  if (!search || !fields.length) return {};
  return {
    $or: fields.map((f) => ({ [f]: { $regex: search, $options: 'i' } })),
  };
};

export const pickQueryFilters = (query, allowed = []) => {
  const filter = {};
  for (const key of allowed) {
    if (query[key] !== undefined && query[key] !== '') {
      filter[key] = query[key];
    }
  }
  return filter;
};
