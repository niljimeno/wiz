package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
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
		hotReload()
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

	finalContents := strings.Builder{}

	scheme, err := os.ReadFile("src/main.scm")
	if err != nil {
		return err
	}

	scheme = bytes.ReplaceAll(scheme, []byte("\\"), []byte("\\\\"))
	scheme = bytes.ReplaceAll(scheme, []byte("`"), []byte("\\`"))

	finalContents.WriteString("const code = ")
	finalContents.WriteString("`")

	finalContents.Write(scheme)

	finalContents.WriteString("`")
	finalContents.WriteString("\n\n")
	finalContents.Write(originalJs)

	err = os.WriteFile("target/index.js", []byte(finalContents.String()), 0644)
	if err != nil {
		return err
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

func hotReload() {
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
			cmd.Run()
			done <- true
		}()
	}

	for range len(args) {
		<-done
		stop()
	}
}
