#!/usr/bin/python3

import os
import sys
import threading
import time
from argparse import ArgumentParser
from http.server import HTTPServer, SimpleHTTPRequestHandler

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


class SimpleHttpServer(threading.Thread):
    def __init__(self, host='localhost', port=4001, path='.'):
        self._base_url = f'http://{host}:{port}'
        self._root_path = path
        self._cwd = os.getcwd()
        self._server = HTTPServer((host, port), SimpleHTTPRequestHandler)
        super().__init__(daemon=True)

    @property
    def base_url(self):
        return self._base_url

    def run(self):
        os.chdir(self._root_path)
        print(f'starting server on port {self._server.server_port}')
        self._server.serve_forever()

    def stop(self):
        os.chdir(self._cwd)
        self._server.shutdown()
        self._server.socket.close()
        print(f'stopping server on port {self._server.server_port}')

def run_unit_test_selenium(
        url,
        pcm_file,
        ref_file,
        input_frequency,
        output_frequency,
        filter_order
        ):
    desired_capabilities = DesiredCapabilities.CHROME
    desired_capabilities['goog:loggingPrefs'] = {'browser': 'ALL'}
    opts = Options()
    opts.headless = True
    print("missed")
    driver = webdriver.Chrome(ChromeDriverManager().install(), desired_capabilities=desired_capabilities, options=opts)
    print("hello")
    print(driver.title)
    driver.get(url)

    wait = WebDriverWait(driver, 10)

    driver.find_element_by_id("pcmFile").send_keys(pcm_file)
    wait.until(EC.visibility_of_element_located((By.ID, "pcmFileLoaded")))

    driver.find_element_by_id("refPcmFile").send_keys(pcm_file)
    wait.until(EC.visibility_of_element_located((By.ID, "refPcmFileLoaded")))

    driver.find_element_by_id("filterOrder").send_keys(filter_order)
    driver.find_element_by_id("inputFrequency").send_keys(input_frequency)
    driver.find_element_by_id("outputFrequency").send_keys(output_frequency)

    driver.find_element_by_id("submit").click()
    wait.until(EC.visibility_of_element_located((By.ID, "testComplete")))
    print("hello")
    test_result = 1
    test_message = "Tests failed"
    for entry in driver.get_log('browser'):
        print(entry['message'])
        if 'Test passed!' in entry['message']:
            test_message = "Tests passed"
            test_result = 0

    driver.close()
    print(test_message)
    return test_result


def main():
    parser = ArgumentParser()

    parser.add_argument(
        '--pcm_file',
        required=True)

    parser.add_argument(
        '--ref_file',
        required=True)

    parser.add_argument(
        '--input_frequency',
        required=True)

    parser.add_argument(
        '--output_frequency',
        required=True)

    parser.add_argument(
        '--filter_order',
        required=True)

    args = parser.parse_args()

    pcm_file_absolute_path = os.path.abspath(args.pcm_file)
    ref_file_absolute_path = os.path.abspath(args.ref_file)

    simple_server = SimpleHttpServer(port=4005, path=os.path.join(os.path.dirname(__file__), '..'))
    test_url = f'{simple_server.base_url}/test/index.html'
    simple_server.start()
    time.sleep(10)

    result = 0
    try:
        result = run_unit_test_selenium(
        test_url,
        pcm_file_absolute_path,
        ref_file_absolute_path,
        args.input_frequency,
        args.output_frequency,
        args.filter_order)
    except WebDriverException as e:
        print(e)
        result = 1
    finally:
        simple_server.stop()
        sys.exit(result)


if __name__ == '__main__':
    main()
