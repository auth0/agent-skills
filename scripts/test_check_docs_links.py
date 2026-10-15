import tempfile, unittest
from pathlib import Path
from check_docs_links import extract_urls, check_urls, collect_urls


class ExtractUrls(unittest.TestCase):
    def test_finds_md_and_txt_fetch_targets(self):
        text = (
            "Fetch `https://auth0.com/docs/customize/portals/overview.md` and\n"
            "(https://auth0.com/pricing.md), index https://auth0.com/docs/llms.txt.\n"
        )
        self.assertEqual(
            extract_urls(text),
            [
                "https://auth0.com/docs/customize/portals/overview.md",
                "https://auth0.com/pricing.md",
                "https://auth0.com/docs/llms.txt",
            ],
        )

    def test_ignores_html_pages_and_other_hosts(self):
        text = "https://auth0.com/docs/quickstart/webapp/nextjs https://example.com/a.md"
        self.assertEqual(extract_urls(text), [])

    def test_dedupes_preserving_order(self):
        u = "https://auth0.com/pricing.md"
        self.assertEqual(extract_urls(f"{u} {u}"), [u])


class CheckUrls(unittest.TestCase):
    def test_ok_markdown_passes(self):
        fetch = lambda url: (200, "text/markdown; charset=utf-8")
        self.assertEqual(check_urls(["https://auth0.com/pricing.md"], fetch), [])

    def test_plain_text_passes_for_llms_txt(self):
        fetch = lambda url: (200, "text/plain; charset=utf-8")
        self.assertEqual(check_urls(["https://auth0.com/docs/llms.txt"], fetch), [])

    def test_404_fails(self):
        fetch = lambda url: (404, "text/html")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/gone.md"], fetch),
            [("https://auth0.com/docs/gone.md", "HTTP 404")],
        )

    def test_html_served_for_md_fails(self):
        fetch = lambda url: (200, "text/html; charset=utf-8")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/x.md"], fetch),
            [("https://auth0.com/docs/x.md", "content-type text/html; charset=utf-8")],
        )

    def test_fetch_exception_fails(self):
        def fetch(url):
            raise OSError("timeout")
        self.assertEqual(
            check_urls(["https://auth0.com/docs/x.md"], fetch),
            [("https://auth0.com/docs/x.md", "error: timeout")],
        )


class CollectUrls(unittest.TestCase):
    def test_walks_references_recursively(self):
        with tempfile.TemporaryDirectory() as d:
            ref = Path(d) / "references" / "feature-x"
            ref.mkdir(parents=True)
            (ref / "index.md").write_text("read https://auth0.com/docs/a.md\n")
            (Path(d) / "SKILL.md").write_text("https://auth0.com/docs/b.md\n")
            self.assertEqual(
                collect_urls(Path(d)),
                {"https://auth0.com/docs/a.md": ["references/feature-x/index.md"],
                 "https://auth0.com/docs/b.md": ["SKILL.md"]},
            )


if __name__ == "__main__":
    unittest.main()
