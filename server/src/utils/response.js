function success(res, data, message = "ok") {
  return res.json({ code: 0, message, data });
}

function fail(res, status, message, details) {
  return res.status(status).json({
    code: status,
    message,
    data: details || null
  });
}

module.exports = { success, fail };
