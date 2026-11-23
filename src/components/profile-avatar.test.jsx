import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileAvatar, buildInitials } from "./profile-avatar";

describe("ProfileAvatar component", () => {
  it("builds monogram initials from separate names or a combined display name", () => {
    assert.equal(buildInitials("Elena", "Torres"), "ET");
    assert.equal(buildInitials("Marina Vega Torres"), "MV");
    assert.equal(buildInitials("Ada"), "A");
    assert.equal(buildInitials("", ""), "AA");
  });

  it("renders initials monogram fallback when src is absent", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar firstName="Elena" lastName="Torres" size="lg" />,
    );
    assert.match(html, /aria-label="Iniciales de Elena Torres"/);
    assert.match(html, />ET<\/span>/);
    assert.doesNotMatch(html, /<img\b/);
  });

  it("renders circular profile image when src is provided", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar
        src="/api/profile/avatar?v=1732406400000"
        name="Elena Torres"
        size="md"
      />,
    );
    assert.match(
      html,
      /<img\b[^>]*src="\/api\/profile\/avatar\?v=1732406400000"[^>]*alt="Foto de perfil de Elena Torres"/,
    );
  });

  it("supports decorative mode for navigation bars and compact table cells", () => {
    const html = renderToStaticMarkup(
      <ProfileAvatar
        src="/api/profile/avatar?v=123"
        name="Elena Torres"
        size="xs"
        decorative
      />,
    );
    assert.match(html, /<img\b[^>]*alt=""[^>]*aria-hidden="true"/);

    const initialsHtml = renderToStaticMarkup(
      <ProfileAvatar name="Elena Torres" size="sm" decorative />,
    );
    assert.match(initialsHtml, /aria-hidden="true"/);
    assert.doesNotMatch(initialsHtml, /aria-label=/);
  });
});
