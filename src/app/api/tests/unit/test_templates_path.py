from importlib import reload
from pathlib import Path


def test_templates_dir_env_override(monkeypatch, tmp_path):
    monkeypatch.setenv("TEMPLATES_DIR", str(tmp_path))
    # reload module to pick up env var
    import app.core.core_api.templates_v1 as tv
    reload(tv)
    assert Path(tv.TEMPLATES_DIR) == tmp_path
