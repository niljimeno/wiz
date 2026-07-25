package main

import (
	"bytes"
	"fmt"
	"os"
	"wizscm/embed"
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

	err = copyFSFile("main.js", "internals/main.js")
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
	originalJs, err := os.ReadFile("internals/main.js")
	if err != nil {
		return err
	}

	scheme := []byte(`(print "hello")`)
	formattedScheme := bytes.ReplaceAll(scheme, []byte("\\"), []byte("\\\\"))
	formattedScheme = append([]byte("const code = '"), formattedScheme...)
	formattedScheme = append(formattedScheme, []byte("'\n\n")...)

	js := append(formattedScheme, originalJs...)
	err = os.WriteFile("index.js", js, 0644)
	if err != nil {
		return err
	}
	return nil
}
