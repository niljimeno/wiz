package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"wiz/embed"
)

func main() {
	if len(os.Args) < 2 {
		displayHelp()
		return
	}

	switch os.Args[1] {
	case "init":
		err := initialiseProject()
		if err != nil {
			fmt.Println(err)
		}

	case "build":
		err := buildProject()
		if err != nil {
			fmt.Println(err)
		}

	case "live":
		liveReload()
	}
}

func displayHelp() {
	fmt.Println("Help")
}

func copyFSFile(originalName, location string) error {
	contents, err := embed.FS.ReadFile(originalName)
	if err != nil {
		return err
	}

	os.WriteFile(location, contents, 0644)

	return nil
}

func initialiseProject() error {
	var err error
	os.Mkdir("target", 0755)
	os.Mkdir("internals", 0755)
	os.Mkdir("src", 0755)
	os.Mkdir("style", 0755)

	err = copyFSFile("index.html", "internals/index.html")
	if err != nil {
		return err
	}

	err = copyFSFile("index.js", "internals/index.js")
	if err != nil {
		return err
	}

	err = copyFSFile("main.scm", "src/main.scm")
	if err != nil {
		return err
	}

	err = copyFSFile("style.css", "style/style.css")
	if err != nil {
		return err
	}

	return nil
}

func buildProject() error {
	os.Mkdir("target", 0755)

	originalJs, err := os.ReadFile("internals/index.js")
	if err != nil {
		originalJs, err = embed.FS.ReadFile("index.js")
		if err != nil {
			return err
		}
	}

	finalJs := strings.Builder{}

	scheme, err := os.ReadFile("src/main.scm")
	if err != nil {
		return err
	}

	scheme = bytes.ReplaceAll(scheme, []byte("\\"), []byte("\\\\"))
	scheme = bytes.ReplaceAll(scheme, []byte("`"), []byte("\\`"))

	finalJs.WriteString("const code = ")
	finalJs.WriteString("`")

	finalJs.Write(scheme)

	finalJs.WriteString("`")
	finalJs.WriteString("\n\n")

	modules := map[string]string{}
	err = filepath.WalkDir("src", func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || path == "src/main.scm" || filepath.Ext(path) != ".scm" {
			return err
		}
		contents, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		name := strings.TrimSuffix(filepath.ToSlash(strings.TrimPrefix(path, "src/")), ".scm")
		modules[name] = string(contents)
		return nil
	})

	if err != nil {
		return err
	}
	moduleData, err := json.Marshal(modules)
	if err != nil {
		return err
	}
	finalJs.WriteString("const modules = ")
	finalJs.Write(moduleData)
	finalJs.WriteString("\n\n")

	finalJs.Write(originalJs)

	err = os.WriteFile("target/index.js", []byte(finalJs.String()), 0644)
	if err != nil {
		return err
	}

	finalCss := strings.Builder{}
	err = filepath.WalkDir("style", func(path string, entry os.DirEntry, err error) error {
		if err != nil || filepath.Ext(path) != ".css" {
			return err
		}
		contents, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}

		finalCss.Write(contents)
		finalCss.WriteString("\n")
		return nil
	})
	if err != nil {
		return err
	}

	err = os.WriteFile("target/style.css", []byte(finalCss.String()), 0644)
	if err != nil {
		return err
	}

	cmd := exec.Command("postcss", "target/style.css", "--use", "postcss-nesting", "--output", "target/style.css")
	err = cmd.Run()
	if err != nil {
		fmt.Println("Error preprocessing css")
	}

	html, err := os.ReadFile("internals/index.html")
	if err != nil {
		html, err = embed.FS.ReadFile("index.html")
		if err != nil {
			return err
		}
	}

	err = os.WriteFile("target/index.html", html, 0644)
	if err != nil {
		return err
	}

	return nil
}

func liveReload() {
	os.Mkdir("target", 0755)
	done := make(chan bool, 2)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
	)
	defer stop()

	args := [][]string{
		{"watchexec", "--watch", "src/", "--", "wiz", "build"},
		{"live-server", "target"},
	}

	for _, arg := range args {
		cmd := exec.CommandContext(ctx, arg[0], arg[1:]...)
		cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
		go func() {
			err := cmd.Run()
			if err != nil {
				fmt.Println("Error: -", err)
			}
			done <- true
		}()
	}

	for range len(args) {
		<-done
		stop()
	}
}
