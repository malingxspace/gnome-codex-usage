UUID := codex-usage@malingxspace
DIST := dist

.PHONY: test install package clean

test:
	node tests/usage-parser.test.mjs
	glib-compile-schemas --strict schemas

install:
	bash scripts/install.sh

package: test
	mkdir -p $(DIST)
	rm -f $(DIST)/$(UUID).zip
	zip -qr $(DIST)/$(UUID).zip . \
		-x '.git/*' 'dist/*' '*.DS_Store'

clean:
	rm -rf $(DIST) schemas/gschemas.compiled
