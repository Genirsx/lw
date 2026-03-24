import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch, truncateHash } from "../api/client";

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState(searchParams.get("type") || "donation");
  const [id, setId] = useState(searchParams.get("id") || "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryId = searchParams.get("id");
    const queryType = searchParams.get("type");
    if (queryId && queryType) {
      setType(queryType);
      setId(queryId);
      handleVerify(queryType, queryId);
    }
  }, []);

  const handleVerify = async (currentType = type, currentId = id) => {
    setResult(null);
    setError("");
    try {
      const endpoint =
        currentType === "disbursement"
          ? `/api/disbursements/${currentId}/verify`
          : `/api/donations/${currentId}/verify`;
      const data = await apiFetch(endpoint);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel">
      <div className="section-head">
        <h3>链上校验</h3>
        <p>输入记录类型和编号，执行“链下重算哈希 + 链上哈希比对”。</p>
      </div>
      <form
        className="form-grid two-column"
        onSubmit={(event) => {
          event.preventDefault();
          handleVerify();
        }}
      >
        <label>
          记录类型
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="donation">捐赠记录</option>
            <option value="disbursement">拨付记录</option>
          </select>
        </label>
        <label>
          记录 ID
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="例如 1" />
        </label>
        <button className="primary-button" type="submit">
          开始校验
        </button>
      </form>

      {error ? <div className="alert error">{error}</div> : null}

      {result ? (
        <div className="verify-result">
          <div className="network-banner">
            <span>网络：{result.chainName}</span>
            <span>模式：{result.chainMode}</span>
            <span>Chain ID：{result.chainId}</span>
          </div>
          <div className="info-grid">
            <div>
              <span>重算哈希一致</span>
              <strong>{result.calculatedOk ? "是" : "否"}</strong>
            </div>
            <div>
              <span>链上哈希一致</span>
              <strong>{result.chainOk ? "是" : "否"}</strong>
            </div>
            <div>
              <span>综合验证结果</span>
              <strong>{result.verified ? "通过" : "未通过"}</strong>
            </div>
          </div>
          <div className="code-block">
            <p>Payload: {result.payload}</p>
            <p>数据库哈希: {result.databaseHash}</p>
            <p>链上哈希: {result.onChainHash || "无"}</p>
            <p>
              交易哈希:{" "}
              {result.explorerTxUrl ? (
                <a href={result.explorerTxUrl} target="_blank" rel="noreferrer">
                  {truncateHash(result.txHash, 14)}
                </a>
              ) : (
                result.txHash || "无"
              )}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
