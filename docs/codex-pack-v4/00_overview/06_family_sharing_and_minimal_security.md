# 가족 공유와 최소 보안

## 1. Audience

이 Site는 **성인 가족·보호자**가 서울 나들이를 계획하는 도구다. 아동이 직접 사용하는 서비스로 설계하거나 마케팅하지 않는다.

## 2. Sharing order

1. 실제 계정에서 지원되고 가족에게 실용적이면 `Selected active users or groups`;
2. 로그인 없는 접근이 필요하면 `Anyone on the internet`;
3. 초기 제품에는 별도 login/authentication을 추가하지 않는다.

Sites가 생성한 URL을 사용하고 custom domain은 초기 범위에서 제외한다.

## 3. 수집하지 않는 정보

- 사용자 이름·이메일·전화번호
- 가족 프로필
- 집 주소·일정
- precise location history
- search/share history
- server-side favorites
- free-text visitor submissions
- third-party behavioral analytics

즐겨찾기가 필요하면 향후 별도 승인 후 browser-local place code만 고려한다.

## 4. Geolocation

- `내 주변` 클릭 전 permission을 요청하지 않는다.
- distance는 browser memory에서만 계산한다.
- coordinates를 Site server, D1, logs, analytics 또는 share URL로 보내지 않는다.
- permission denial은 정상 상태이며 distance sort만 비활성화한다.

## 5. Public read and protected write

Public read routes에는 공개 Seoul data와 non-personal aggregates만 포함한다.

Internal write route minimum:

- HTTPS
- POST only
- `Authorization: Bearer <SITE_INGEST_TOKEN>`
- at least 32 random bytes
- body size limit
- JSON schema and semantic validation
- deterministic idempotency key
- conflicting replay rejection
- no secret/raw key URL in responses or logs

## 6. Public-link warning

`noindex,nofollow`는 검색 노출 억제 요청이며 access control이 아니다. 공개 링크를 선택하면 누구나 URL을 전달받아 열 수 있다고 가정한다.

## 7. Minimal release flow

```text
exact reviewed commit
→ Save version
→ owner-only/limited review
→ choose narrowest practical audience
→ explicit owner approval
→ Deploy
→ test intended family visitor path
```

GitHub Actions는 이 release flow를 수행하지 않는다.
