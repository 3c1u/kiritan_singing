#include <fstream>
#include <iostream>
#include <memory>

#include "src/include/sinsy/LabelStrings.h"
#include "src/include/sinsy/sinsy.h"

using namespace std;
using namespace sinsy;

int main(int argc, const char **argv) {
  if (argc < 4) {
    cerr << "insufficient arguments" << endl;
    return 0;
  }

  Sinsy s;
  s.setLanguages("j", argv[1]);
  s.loadScoreFromMusicXML(argv[2]);

  auto     label = s.createLabelData(false, 1, 1);
  ofstream output(argv[3]);
  auto     data = label->getData();

  for (size_t size = label->size(), i = 0; i < size; ++i) {
    output << data[i] << '\n';
  }

  delete label;

  return 0;
}
