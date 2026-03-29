function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10)));

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

function buildPaginatedResult(items, total, page, pageSize) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

module.exports = { parsePagination, buildPaginatedResult };
