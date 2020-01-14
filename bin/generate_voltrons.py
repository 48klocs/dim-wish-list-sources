import yaml

DEFINITION_FILE = "voltron_list.yaml"


def main():
    with open(DEFINITION_FILE) as f:
        ymlRaw = yaml.load(f)

    fileGroupsRaw = ymlRaw["definitions"]
    fileGroups = {}
    for definition in fileGroupsRaw.keys():
        fileGroups[definition] = FileGroup(definition, fileGroupsRaw[definition])
    
    outputFilesRaw = ymlRaw["outputFiles"]
    outputFiles = {}
    for k,v in outputFilesRaw.iteritems():
        outputFiles[k] = OutputFile(k, v, fileGroups)

    for k, v in outputFiles.iteritems():
        print "Generating {}.txt".format(k)
        v.printFile()

class OutputFile:
    def __init__(self, fileName, fileDefinition, fileGroupMap):
        self.fileName = fileName
        self.description = fileDefinition["description"]
        self.title = fileDefinition["title"]
        self.fileGroups = [ fileGroupMap[fg] for fg in fileDefinition["fileGroups"]]
    def getLines(self):
        lines = ["title: {}".format(self.title), "description: {}".format(self.description)]
        for f in self.fileGroups:
            lines = lines + [""] + f.getLines()
        return lines
    def getString(self):
        return "\n".join(self.getLines())
    def printFile(self):
        with open("{}.txt".format(self.fileName), 'w') as f:
            f.write(self.getString())


class FileGroup:
    def __init__(self, groupName, fileList):
        self.name = groupName
        self.files = {}
        for fileName in fileList:
            self.files[fileName] = WishlistInputFile(fileName)
    def getLines(self):
        lines = []
        for file in self.files.values():
            lines = lines + file.readFile()
        return lines
    def getString(self):
        return "\n".join(self.getLines())


class WishlistInputFile:
    def __init__(self, fileName):
        self.fileName = fileName
        self.lines = []

    def readFile(self):
        if not len(self.lines):
            with open(self.fileName) as f:
                lines = f.readlines()
            self.lines = [x.strip() for x in lines]
        return self.lines
    

if __name__ == "__main__":
    main()