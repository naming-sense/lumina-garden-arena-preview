# Garden Arena Reference-Matched Placement · Three.js v4

`garden-arena-flooronly-threejs-v8` 바닥 위의 Tripo 메시를 원화 구도에 맞춰 다시 배치한 브라우저 프리뷰다. 좌우 대칭, 중앙 전투 공간, 상·하단 게이트, 측면 포탈·폭포, 외곽 수로·담장·식생의 대응 위치를 기준으로 삼았다.

고정 공개 프리뷰: <https://naming-sense.github.io/lumina-garden-arena-preview/demo/?quality=mobile&v=5>

## 장면 구성

- 핵심: 크리스탈 제단 1, 포탈 4, 상·하단 게이트 2, 랜턴탑 4
- 식생: 큰 나무 7, 야자수 6, 꽃·덤불 클러스터 20
- 담장/엄폐: 직선 담장 34, 코너 담장 4
- 수경: 직선 수로 11, 측면 폭포·절벽 2
- 고유 GLB 13개, 총 인스턴스 95개

직선 담장 메시의 축소 인스턴스를 원화의 내부 엄폐물 자리에도 배치해 현재 키트만으로 플레이 구도를 읽을 수 있게 했다. 위치·Y축 회전·개별 스케일은 `scene-placement.json`에 분리되어 있다.

## 주요 파일

- `00-concept-reference.jpg` — 배치 기준 원화
- `01-floor-only-map.png` — v8 완성 바닥, 2048×1152
- `02-tilemap-occupancy-160x90.json` — 기존 게임 판정 타일맵
- `models/*.glb` — 텍스처가 내장된 Tripo 메시 13종
- `models-web/*.glb` — 원본 메시를 보존하면서 텍스처를 1024px WebP로 줄인 웹 전용 GLB 13종
- `scene-placement.json` — 모델 URL, 정규화 높이, 인스턴스 배치 데이터
- `demo/` — CDN 없이 실행되는 Three.js r180 데모
- `garden-arena-environment-placement-v3-preview.png` — Chrome WebGL Match view 렌더
- `garden-arena-environment-placement-v3-top.png` — Chrome WebGL Top view 렌더
- `validation.json` — 실제 브라우저 및 Blender 검증 결과

## 배치 편집

`position`은 `[x, y, z]`, `rotationY`는 degree, `scale`은 선택적 인스턴스 배율이다. 바닥 범위는 X `-8..8`, Z `-4.5..4.5`이며 이미지 상단이 음수 Z다. `targetHeight`를 바꾸면 GLB가 bottom-center 피벗을 기준으로 자동 정규화된다.

## 실행

```bash
cd garden-arena-environment-placement-threejs-v2
python3 -m http.server 8795
```

브라우저에서 `http://localhost:8795/demo/`를 연다. 화면 우측 아래에서 기준 원화를 함께 비교할 수 있고 패널의 `Original` 토글로 숨길 수 있다. `?view=top`은 탑뷰, `?ui=0`은 캡처용 UI 숨김 모드다.

## 성능 주의

실제 Chrome WebGL에서 13개 GLB와 95개 인스턴스, 2,452,063 rendered triangles를 확인했다. 현재 장면은 고품질 배치 프리뷰다. 모바일 게임 투입 전에는 환경 에셋 리토폴로지/LOD, 반복 담장 인스턴싱, 단순 충돌체, 수로·폭포 전용 애니메이션 셰이더를 적용한다.

웹 프리뷰는 원본 4K 텍스처 GLB 118.5MB 대신 1024px WebP GLB 11.8MB를 로드한다. 예상 텍스처 GPU 메모리는 약 3.49GB에서 218MB로 줄었고, 모바일에서는 모델을 2개씩 로드하며 그림자·안티앨리어싱·고해상도 픽셀 비율을 비활성화한다. 로딩 퍼센트는 내부 요청 수가 늘어나도 뒤로 되돌아가지 않는다.
